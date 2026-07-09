import { pathToFileURL } from "node:url"
import { createBodyReader } from "./request"
import { htmlResponse, isFailResult, notFound } from "./response"
import { matchRoute } from "./router"
import { commitSession, createSession, type Session } from "./session"
import { createActionForm } from "../route/action"
import { renderPageView } from "../render/view"
import type { RouteManifest } from "../scanner/route-manifest"
import { scanRoutes } from "../scanner/scan-routes"
import { servePublic } from "../static/serve-public"
import { resolvePath } from "../utils/path"
import type { ResolvedKumquatConfig } from "../config/types"

export type KumquatAppOptions = {
  root: string
  config: ResolvedKumquatConfig
  manifest?: RouteManifest
  dev?: boolean
}

export function createKumquatApp(options: KumquatAppOptions): { fetch(req: Request): Promise<Response> } {
  return {
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url)
      const session = createSession(req, options.config.session)
      const manifest = options.dev ? scanRoutes(resolvePath(options.root, options.config.app.routesDir)) : options.manifest ?? []
      const publicResponse = await servePublic(resolvePath(options.root, options.config.app.publicDir), url)

      if (publicResponse) {
        return commitSession(publicResponse, session)
      }

      let response: Response
      if (url.pathname.startsWith("/api/")) {
        response = await handleApi(req, url, manifest, session)
      } else {
        response = await handlePage(req, url, manifest, options, session)
      }

      return commitSession(response, session)
    }
  }
}

async function handleApi(req: Request, url: URL, manifest: RouteManifest, session: Session): Promise<Response> {
  const match = matchRoute(manifest, url.pathname, "api")
  if (!match?.item.apiModule) {
    return notFound()
  }

  const module = await importFresh(match.item.apiModule)
  const handler = module[req.method]

  if (typeof handler !== "function") {
    return new Response("Method Not Allowed", { status: 405 })
  }

  return handler({
    req,
    url,
    params: match.params,
    query: url.searchParams,
    session,
    body: createBodyReader(req)
  })
}

async function handlePage(
  req: Request,
  url: URL,
  manifest: RouteManifest,
  options: KumquatAppOptions,
  session: Session
): Promise<Response> {
  const match = matchRoute(manifest, url.pathname, "page")
  if (!match?.item.pageHtml) {
    return notFound()
  }

  if (req.method === "POST" && url.search.startsWith("?/")) {
    return handleAction(req, url, match, options, session)
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 })
  }

  return renderPage(req, url, match, options, session)
}

async function handleAction(
  req: Request,
  url: URL,
  match: NonNullable<ReturnType<typeof matchRoute>>,
  options: KumquatAppOptions,
  session: Session
): Promise<Response> {
  const actionName = decodeURIComponent(url.search.slice(2))

  if (!actionName || !match.item.actionsModule) {
    return notFound()
  }

  const module = await importFresh(match.item.actionsModule)
  const handler = module[actionName]

  if (typeof handler !== "function") {
    return notFound()
  }

  const result = await handler({
    req,
    url,
    params: match.params,
    query: url.searchParams,
    session,
    form: createActionForm(await req.formData())
  })

  if (isFailResult(result)) {
    return renderPage(req, url, match, options, session, result.data, result.status)
  }

  return result
}

async function renderPage(
  req: Request,
  url: URL,
  match: NonNullable<ReturnType<typeof matchRoute>>,
  options: KumquatAppOptions,
  session: Session,
  extraData: Record<string, unknown> = {},
  status = 200
): Promise<Response> {
  let data: Record<string, unknown> = {}

  if (match.item.pageModule) {
    const module = await importFresh(match.item.pageModule)
    const handler = module.default

    if (typeof handler === "function") {
      const result = await handler({
        req,
        url,
        params: match.params,
        query: url.searchParams,
        session,
        user: null
      })

      if (result instanceof Response) {
        return result
      }

      if (isRecord(result)) {
        data = result
      }
    }
  }

  const html = renderPageView({
    pageHtmlPath: match.item.pageHtml ?? "",
    appRoot: resolvePath(options.root, options.config.app.root),
    routesDir: resolvePath(options.root, options.config.app.routesDir),
    routeDir: match.item.routeDir,
    data: { ...data, ...extraData }
  })

  return htmlResponse(html, { status })
}

async function importFresh(filePath: string): Promise<Record<string, unknown>> {
  return import(`${pathToFileURL(filePath).href}?t=${Date.now()}`) as Promise<Record<string, unknown>>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
