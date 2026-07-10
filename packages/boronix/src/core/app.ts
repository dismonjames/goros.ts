import { existsSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import path from "node:path"
import { BoronixUserError, diagnoseError, renderDevErrorPage as renderDiagnosticDevErrorPage, type BoronixErrorPhase, type BoronixDiagnostic } from "./errors"
import { createBodyReader, readFormData } from "./request"
import { htmlResponse, isFailResult, notFound, json } from "./response"
import { matchRoute } from "./router"
import { createAuth, type Auth } from "./auth"
import { createFlash, type Flash } from "./flash"
import { commitSession, createSession, type Session } from "./session"
import { createActionForm } from "../route/action"
import { renderPageView, collectLayouts } from "../render/view"
import type { RouteManifest, RouteManifestItem } from "../scanner/route-manifest"
import { scanRoutes } from "../scanner/scan-routes"
import { servePublic } from "../static/serve-public"
import { resolvePath } from "../utils/path"
import type { ResolvedBoronixConfig } from "../config/types"
import { renderTemplate } from "../render/template"
import { detectSessionUsage } from "../utils/session-usage"

import { logRequest, isStaticAsset } from "../cli/ui/activity"

export type BoronixAppOptions = {
  root: string
  config: ResolvedBoronixConfig
  manifest?: RouteManifest | undefined
  dev?: boolean | undefined
  quiet?: boolean | undefined
  verbose?: boolean | undefined
  plain?: boolean | undefined
}

export function createBoronixApp(options: BoronixAppOptions): { fetch(req: Request): Promise<Response> } {
  // If in production, and session is used, check secret
  const isProd = !options.dev
  if (isProd) {
    const hasSession = detectSessionUsage(options.root)
    const isSecretDefault = !options.config.session.secret || options.config.session.secret === "boronix-dev-session-secret"
    if (hasSession && isSecretDefault) {
      throw new BoronixUserError(
        "A session secret is required in production.\nSet session.secret in boronix.config.ts or provide BORONIX_SESSION_SECRET.",
        {
          code: "KQ_SESSION_SECRET_MISSING",
          hint: "Set session.secret in boronix.config.ts or provide BORONIX_SESSION_SECRET."
        }
      )
    }
  }

  return {
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url)
      const requestId = "req_" + (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2) + Date.now().toString(36)
      ).replace(/-/g, "").substring(0, 16)

      const session = createSession(req, options.config.session)
      const auth = createAuth(session)
      const flash = createFlash(session)
      
      let manifest: RouteManifest
      try {
        manifest = options.dev ? scanRoutes(resolvePath(options.root, options.config.app.routesDir)) : options.manifest ?? []
      } catch (err: any) {
        const errRes = handleDevOrErrorPageResponse(err, "config", req, url, [], options, undefined, requestId)
        const finalResponse = commitSession(errRes, session)
        return applyResponseHeaders(finalResponse, requestId, !!options.dev, options.config)
      }

      // Serve Health Check
      if (options.config.health?.enabled && url.pathname === options.config.health.path && req.method === "GET") {
        const matched = matchRoute(manifest, url.pathname, "page") || matchRoute(manifest, url.pathname, "api")
        if (!matched) {
          const res = json({
            status: "ok",
            framework: "boronix",
            version: "0.6.0"
          })
          const finalResponse = commitSession(res, session)
          return applyResponseHeaders(finalResponse, requestId, !!options.dev, options.config)
        }
      }

      const startTime = performance.now()
      let status = 200
      let kind: "serve" | "render" | "api" | "action" | "miss" | "error" = "serve"
      let extra = ""
      let response: Response | null = null

      try {
        const publicResponse = await servePublic(resolvePath(options.root, options.config.app.publicDir), url, req)
        if (publicResponse) {
          response = publicResponse
          kind = "serve"
        } else {
          if (url.pathname.startsWith("/api/")) {
            kind = "api"
            const matched = matchRoute(manifest, url.pathname, "api")
            if (!matched) {
              kind = "miss"
              response = handleNotFoundResponse(req, url, manifest, options)
            } else {
              response = await handleApi(req, url, manifest, session, auth, flash, requestId)
            }
          } else {
            const matched = matchRoute(manifest, url.pathname, "page")
            if (!matched) {
              kind = "miss"
              response = handleNotFoundResponse(req, url, manifest, options)
            } else {
              if (req.method === "POST" && url.search.startsWith("?/")) {
                kind = "action"
              } else {
                kind = matched.item.pageModule ? "render" : "serve"
              }
              response = await handlePage(req, url, manifest, options, session, auth, flash, requestId)
            }
          }
        }

        status = response.status
        if (status >= 300 && status < 400) {
          extra = response.headers.get("location") ?? ""
        } else if (status >= 400 && status < 500) {
          if (kind === "action") {
            extra = "fail"
          } else if (kind === "miss") {
            extra = ""
          }
        }

        const finalResponse = commitSession(response, session)
        return applyResponseHeaders(finalResponse, requestId, !!options.dev, options.config)
      } catch (err: any) {
        status = err.status || 500
        if (err instanceof Response) {
          status = err.status
        }
        
        if (kind === "serve") {
          kind = "error"
        }
        
        extra = !options.dev && status >= 500 ? "error" : (err.code || err.message || "")

        const matched = matchRoute(manifest, url.pathname, "page") || matchRoute(manifest, url.pathname, "api")
        const phase = determineErrorPhase(err, kind)
        
        const errorResponse = handleDevOrErrorPageResponse(err, phase, req, url, manifest, options, matched?.item, requestId)
        const finalResponse = commitSession(errorResponse, session)
        return applyResponseHeaders(finalResponse, requestId, !!options.dev, options.config)
      } finally {
        const duration = Math.round(performance.now() - startTime)
        const configLog = options.config.cli.requestLog
        const isCliRunning = options.quiet !== undefined || options.verbose !== undefined || options.plain !== undefined || options.dev
        
        if (configLog && isCliRunning) {
          const isStatic = isStaticAsset(url.pathname)
          const isQuiet = options.quiet === true
          const isVerbose = options.verbose === true
          
          if (isStatic && !isVerbose) {
            // skip static logs
          } else if (isQuiet && status < 500) {
            // skip normal logs in quiet mode
          } else {
            let logExtra = extra
            if (!options.dev && requestId) {
              logExtra = (logExtra ? `${logExtra} ` : "") + requestId
            }
            logRequest(req.method, url.pathname + url.search, status, kind, duration, logExtra, options.dev)
          }
        }
      }
    }
  }
}

function determineErrorPhase(err: any, kind: string): BoronixErrorPhase {
  if (err?.phase) return err.phase
  if (kind === "action") return "action"
  if (kind === "api") return "api"
  if (kind === "render") return "page-render"
  return "unknown"
}

async function handleApi(req: Request, url: URL, manifest: RouteManifest, session: Session, auth: Auth, flash: Flash, requestId?: string): Promise<Response> {
  const match = matchRoute(manifest, url.pathname, "api")
  if (!match?.item.apiModule) {
    return notFound()
  }

  let module
  try {
    module = await importFresh(match.item.apiModule)
  } catch (err: any) {
    err.phase = "api"
    throw err
  }
  
  const handler = module[req.method]

  if (typeof handler !== "function") {
    return new Response("Method Not Allowed", { status: 405 })
  }

  try {
    const result = await handler({
      req,
      url,
      params: match.params,
      query: url.searchParams,
      session,
      auth,
      flash,
      requestId,
      body: createBodyReader(req)
    })
    
    if (result instanceof Response) {
      if (result.status === 404) {
        return json({ error: "Not Found", message: "Resource not found" }, { status: 404 })
      }
      return result
    }
    return result
  } catch (err: any) {
    if (err instanceof Response && err.status === 404) {
      return json({ error: "Not Found", message: "Resource not found" }, { status: 404 })
    }
    err.phase = "api"
    throw err
  }
}

async function handlePage(
  req: Request,
  url: URL,
  manifest: RouteManifest,
  options: BoronixAppOptions,
  session: Session,
  auth: Auth,
  flash: Flash,
  requestId?: string
): Promise<Response> {
  const match = matchRoute(manifest, url.pathname, "page")
  if (!match?.item.pageHtml) {
    return handleNotFoundResponse(req, url, manifest, options)
  }

  try {
    if (req.method === "POST" && url.search.startsWith("?/")) {
      const response = await handleAction(req, url, match, options, session, auth, flash, requestId)
      if (response instanceof Response && response.status === 404) {
        return handleNotFoundResponse(req, url, manifest, options, match.item.routeDir)
      }
      return response
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 })
    }

    const response = await renderPage(req, url, match, options, session, auth, flash, undefined, 200, requestId)
    if (response instanceof Response && response.status === 404) {
      return handleNotFoundResponse(req, url, manifest, options, match.item.routeDir)
    }
    return response
  } catch (err: any) {
    if (err instanceof Response && err.status === 404) {
      return handleNotFoundResponse(req, url, manifest, options, match.item.routeDir)
    }
    throw err
  }
}

async function handleAction(
  req: Request,
  url: URL,
  match: NonNullable<ReturnType<typeof matchRoute>>,
  options: BoronixAppOptions,
  session: Session,
  auth: Auth,
  flash: Flash,
  requestId?: string
): Promise<Response> {
  if (req.method !== "POST") {
    throw new BoronixUserError(`Actions must be requested using POST method. Found: ${req.method}`, {
      code: "KQ_INVALID_ACTION_METHOD",
      hint: "Change the form method to POST."
    })
  }

  const actionName = decodeURIComponent(url.search.slice(2))

  if (!actionName) {
    throw new BoronixUserError("Form action name is missing.", {
      code: "KQ_ACTION_NOT_FOUND",
      hint: 'Specify action name like action="?/login"'
    })
  }

  if (!match.item.actionsModule) {
    throw new BoronixUserError(`Action "${actionName}" was not found for route "${match.item.routePath}".`, {
      code: "KQ_ACTION_NOT_FOUND",
      hint: "Ensure actions.ts exists and exports the action function."
    })
  }

  let module
  try {
    module = await importFresh(match.item.actionsModule)
  } catch (err: any) {
    err.phase = "action"
    throw err
  }

  const handler = module[actionName]

  if (handler !== undefined && typeof handler !== "function") {
    throw new BoronixUserError(`Action \`${actionName}\` is not a function.`, {
      code: "KQ_ACTION_INVALID_SHAPE",
      file: path.relative(options.root, match.item.actionsModule),
      hint: `Ensure \`${actionName}\` is wrapped in the \`action()\` helper.`
    })
  }

  if (typeof handler === "function" && !(handler as any)._isBoronixAction) {
    throw new BoronixUserError(`Action \`${actionName}\` was not wrapped in \`action()\` helper.`, {
      code: "KQ_ACTION_NOT_WRAPPED",
      file: path.relative(options.root, match.item.actionsModule),
      hint: `Wrap the handler like: export const ${actionName} = action(async () => { ... })`
    })
  }

  if (!handler) {
    const foundActions = Object.keys(module).filter(k => k !== "default" && typeof module[k] === "function")
    throw new BoronixUserError(`Action "${actionName}" was not found for route "${match.item.routePath}".`, {
      code: "KQ_ACTION_NOT_FOUND",
      file: path.relative(options.root, match.item.actionsModule),
      expected: `export const ${actionName} = action(async () => {\n  ...\n})`,
      found: foundActions.length > 0 ? foundActions.join(", ") : "none",
      hint: "Rename the export or update the form action."
    })
  }

  let result
  try {
    result = await handler({
      req,
      url,
      params: match.params,
      query: url.searchParams,
      session,
      auth,
      flash,
      requestId,
      form: createActionForm(await readFormData(req))
    })
  } catch (err: any) {
    err.phase = "action"
    throw err
  }

  if (result === undefined || (typeof result !== "object" && !(result instanceof Response))) {
    throw new BoronixUserError(`Action \`${actionName}\` returned an invalid type.`, {
      code: "KQ_ACTION_INVALID_RETURN",
      file: path.relative(options.root, match.item.actionsModule),
      hint: "Action must return a Response or a fail() helper result."
    })
  }

  if (result !== null && typeof result === "object" && !isFailResult(result) && !(result instanceof Response)) {
    throw new BoronixUserError(`Action \`${actionName}\` returned an invalid object structure.`, {
      code: "KQ_ACTION_INVALID_RETURN",
      file: path.relative(options.root, match.item.actionsModule),
      hint: "Action must return a Response or a fail() helper result."
    })
  }

  if (isFailResult(result)) {
    return renderPage(req, url, match, options, session, auth, flash, result.data, result.status, requestId)
  }

  return result
}

async function renderPage(
  req: Request,
  url: URL,
  match: NonNullable<ReturnType<typeof matchRoute>>,
  options: BoronixAppOptions,
  session: Session,
  auth: Auth,
  flash: Flash,
  extraData: Record<string, unknown> = {},
  status = 200,
  requestId?: string
): Promise<Response> {
  let data: Record<string, unknown> = {}

  if (match.item.pageModule) {
    let module
    try {
      module = await importFresh(match.item.pageModule)
    } catch (err: any) {
      err.phase = "page-loader"
      throw err
    }

    const handler = module.default

    if (typeof handler === "function") {
      let result
      try {
        result = await handler({
          req,
          url,
          params: match.params,
          query: url.searchParams,
          session,
          auth,
          flash,
          requestId,
          user: null
        })
      } catch (err: any) {
        err.phase = "page-loader"
        throw err
      }

      if (result instanceof Response) {
        return result
      }

      if (isRecord(result)) {
        data = result
      }
    }
  }

  let html = ""
  try {
    html = renderPageView({
      pageHtmlPath: match.item.pageHtml ?? "",
      appRoot: resolvePath(options.root, options.config.app.root),
      routesDir: resolvePath(options.root, options.config.app.routesDir),
      routeDir: match.item.routeDir,
      data: { ...data, ...extraData, flash: flash.consume() }
    })
  } catch (err: any) {
    let layouts
    try {
      layouts = collectLayouts(
        resolvePath(options.root, options.config.app.root),
        resolvePath(options.root, options.config.app.routesDir),
        match.item.routeDir
      )
    } catch {}
    
    err.phase = layouts ? "page-render" : "layout"
    throw err
  }

  return htmlResponse(html, { status })
}

async function importFresh(filePath: string): Promise<Record<string, unknown>> {
  return import(pathToFileURL(filePath).href) as Promise<Record<string, unknown>>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export function findClosestNotFound(appRoot: string, routesDir: string, routeDir?: string): string | null {
  if (routeDir) {
    let current = routeDir
    while (current.startsWith(routesDir)) {
      const nfPath = path.join(current, "not-found.html")
      if (existsSync(nfPath)) {
        return nfPath
      }
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }
  }
  const globalNf = path.join(appRoot, "not-found.html")
  if (existsSync(globalNf)) {
    return globalNf
  }
  return null
}

export function findClosestErrorPage(appRoot: string, routesDir: string, routeDir?: string): string | null {
  if (routeDir) {
    let current = routeDir
    while (current.startsWith(routesDir)) {
      const errPath = path.join(current, "error.html")
      if (existsSync(errPath)) {
        return errPath
      }
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }
  }
  const globalErr = path.join(appRoot, "error.html")
  if (existsSync(globalErr)) {
    return globalErr
  }
  return null
}

function findRouteCandidates(manifest: RouteManifest, pathname: string): string[] {
  const candidates: string[] = []
  for (const item of manifest) {
    if (item.kind === "page" && item.routePath) {
      candidates.push(item.routePath)
    }
  }
  return candidates.filter(c => {
    const cSegs = c.split("/").filter(Boolean)
    const pSegs = pathname.split("/").filter(Boolean)
    const intersection = cSegs.filter(s => pSegs.includes(s))
    return intersection.length > 0 || Math.abs(cSegs.length - pSegs.length) <= 1
  }).slice(0, 5)
}

function renderDefaultNotFoundHtml(pathname: string, method: string, manifest: RouteManifest, dev: boolean): string {
  const candidates = dev ? findRouteCandidates(manifest, pathname) : []
  const candidatesList = candidates.map(c => `<li><a href="${c}">${c}</a></li>`).join("")
  const candidatesHtml = candidates.length > 0 
    ? `<div class="candidates">
        <h3>Route candidates:</h3>
        <ul>${candidatesList}</ul>
       </div>`
    : ""

  const devInfo = dev 
    ? `<div class="dev-info">
        <p><strong>Method:</strong> ${method}</p>
        <p><strong>Path:</strong> ${pathname}</p>
        ${candidatesHtml}
        <p class="hint">Check your <code>app/routes/</code> directory to ensure the route exists.</p>
       </div>`
    : `<p>The page you are looking for does not exist.</p>`

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>404 - Not Found</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 40px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    }
    h1 {
      color: #f43f5e;
      margin-top: 0;
      font-size: 2rem;
      border-bottom: 1px solid #334155;
      padding-bottom: 15px;
    }
    h3 {
      color: #94a3b8;
      margin-top: 20px;
    }
    p {
      color: #cbd5e1;
      line-height: 1.6;
    }
    code {
      background: #0f172a;
      padding: 3px 6px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9em;
      color: #38bdf8;
    }
    .dev-info {
      margin-top: 25px;
      background: #0f172a;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #1e293b;
    }
    .hint {
      color: #e2e8f0;
      margin-top: 15px;
      font-style: italic;
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin-bottom: 8px;
    }
    a {
      color: #38bdf8;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>404 - Not Found</h1>
    ${devInfo}
  </div>
</body>
</html>
  `
}

export function handleNotFoundResponse(
  req: Request,
  url: URL,
  manifest: RouteManifest,
  options: BoronixAppOptions,
  routeDir?: string
): Response {
  if (url.pathname.startsWith("/api/")) {
    return json({ error: "Not Found", message: `API route ${url.pathname} not found` }, { status: 404 })
  }

  const appRoot = resolvePath(options.root, options.config.app.root)
  const routesDir = resolvePath(options.root, options.config.app.routesDir)

  const closestNf = findClosestNotFound(appRoot, routesDir, routeDir)
  if (closestNf) {
    try {
      const content = readFileSync(closestNf, "utf8")
      const rendered = renderTemplate(content, { route: url.pathname, method: req.method })
      return htmlResponse(rendered, { status: 404 })
    } catch {}
  }

  const html = renderDefaultNotFoundHtml(url.pathname, req.method, manifest, !!options.dev)
  return htmlResponse(html, { status: 404 })
}

function renderDefaultProductionErrorHtml(message: string, status: number, requestId?: string): string {
  const msg = status >= 500 ? "Internal Server Error" : message
  const reqIdHtml = requestId ? `<p style="font-size: 0.85rem; color: #64748b; margin-top: 20px;">Request ID: ${escapeHtml(requestId)}</p>` : ""
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Error ${status}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 40px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      text-align: center;
    }
    h1 {
      color: #f43f5e;
      margin-top: 0;
      font-size: 2rem;
    }
    p {
      color: #cbd5e1;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Something went wrong</h1>
    <p>${escapeHtml(msg)}</p>
    ${reqIdHtml}
  </div>
</body>
</html>
  `
}

export function renderDevErrorPage(diagnostic: BoronixDiagnostic): string {
  const hintsList = (diagnostic.hints ?? []).map(h => `<li>${escapeHtml(h)}</li>`).join("")
  const hintsHtml = (diagnostic.hints && diagnostic.hints.length > 0)
    ? `<div class="hints">
        <h3>Suggestions / Hints</h3>
        <ul>${hintsList}</ul>
       </div>`
    : ""

  const codeFrameHtml = diagnostic.codeFrame
    ? `<div class="code-frame">
        <div class="code-frame-title">${escapeHtml(diagnostic.file ?? "")}</div>
        <pre><code>${escapeHtml(diagnostic.codeFrame)}</code></pre>
       </div>`
    : ""

  const matchedPatternHtml = diagnostic.pattern
    ? `<div class="meta-item"><span class="meta-label">Pattern:</span> <code class="meta-val">${escapeHtml(diagnostic.pattern)}</code></div>`
    : ""

  const sourceFileHtml = diagnostic.file
    ? `<div class="meta-item"><span class="meta-label">Source File:</span> <code class="meta-val">${escapeHtml(diagnostic.file)}</code></div>`
    : ""

  const actionHtml = diagnostic.action
    ? `<div class="meta-item"><span class="meta-label">Action:</span> <code class="meta-val">${escapeHtml(diagnostic.action)}</code></div>`
    : ""

  const stackHtml = diagnostic.stack
    ? `<div class="stack-trace">
        <h3>Stack Trace</h3>
        <pre><code>${escapeHtml(diagnostic.stack)}</code></pre>
       </div>`
    : ""

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Boronix Error</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f1f5f9;
      margin: 0;
      padding: 40px;
      box-sizing: border-box;
      line-height: 1.5;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 2px solid #f43f5e;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .brand {
      color: #f43f5e;
      font-weight: 700;
      font-size: 1.1rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 8px;
    }
    h1 {
      margin: 0;
      font-size: 2.2rem;
      color: #fff;
      font-weight: 800;
      word-break: break-word;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 15px;
      background: #1e293b;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      border: 1px solid #334155;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      color: #94a3b8;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .meta-val {
      color: #e2e8f0;
      font-size: 0.95rem;
      font-weight: 600;
    }
    code.meta-val {
      background: #0f172a;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85em;
      color: #38bdf8;
      align-self: flex-start;
      word-break: break-all;
    }
    .code-frame {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      margin-bottom: 30px;
      overflow: hidden;
    }
    .code-frame-title {
      background: #1e293b;
      padding: 10px 20px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
      border-bottom: 1px solid #334155;
      color: #cbd5e1;
    }
    pre {
      margin: 0;
      padding: 20px;
      overflow-x: auto;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9rem;
    }
    .code-frame code {
      color: #e2e8f0;
    }
    .code-frame pre {
      background: #0f172a;
    }
    .hints {
      background: #172554;
      border: 1px solid #1e3a8a;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .hints h3 {
      margin-top: 0;
      color: #60a5fa;
      font-size: 1.1rem;
    }
    .hints ul {
      margin: 0;
      padding-left: 20px;
      color: #93c5fd;
    }
    .hints li {
      margin-bottom: 8px;
    }
    .stack-trace {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 20px;
    }
    .stack-trace h3 {
      margin-top: 0;
      color: #cbd5e1;
      border-bottom: 1px solid #334155;
      padding-bottom: 10px;
    }
    .stack-trace code {
      color: #f1f5f9;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Boronix Dev Error</div>
      <h1>${escapeHtml(diagnostic.message)}</h1>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><span class="meta-label">Route:</span> <code class="meta-val">${escapeHtml(diagnostic.route ?? "")}</code></div>
      ${matchedPatternHtml}
      <div class="meta-item"><span class="meta-label">Phase:</span> <code class="meta-val">${escapeHtml(diagnostic.phase)}</code></div>
      ${sourceFileHtml}
      ${actionHtml}
    </div>

    ${hintsHtml}
    ${codeFrameHtml}
    ${stackHtml}
  </div>
</body>
</html>
  `
}

export function handleDevOrErrorPageResponse(
  error: unknown,
  phase: BoronixErrorPhase,
  req: Request,
  url: URL,
  manifest: RouteManifest,
  options: BoronixAppOptions,
  item?: RouteManifestItem,
  requestId?: string
): Response {
  const root = options.root
  const diagnostic = diagnoseError(error, root, phase)
  diagnostic.route = url.pathname + url.search
  diagnostic.pattern = item?.routePath
  diagnostic.method = req.method
  
  let status = 500
  if (error && typeof error === "object" && "status" in (error as any)) {
    status = (error as any).status
  } else if (error instanceof Response) {
    status = error.status
  }
  diagnostic.status = status

  // If API request, return JSON
  if (url.pathname.startsWith("/api/")) {
    if (options.dev) {
      return json({
        error: {
          message: diagnostic.message,
          phase: diagnostic.phase,
          code: (error as any)?.code,
          file: diagnostic.file,
          stack: diagnostic.stack,
          codeFrame: diagnostic.codeFrame,
          hints: diagnostic.hints,
          requestId
        }
      }, { status })
    } else {
      const is4xx = status >= 400 && status < 500
      const code = is4xx ? ((error as any)?.code || "BAD_REQUEST") : "INTERNAL_SERVER_ERROR"
      const message = is4xx ? (diagnostic.message || "Bad Request") : "Internal Server Error"
      return json({
        error: {
          code,
          message,
          requestId
        }
      }, { status: is4xx ? status : 500 })
    }
  }

  // HTML page request
  if (options.dev) {
    const html = renderDiagnosticDevErrorPage(diagnostic)
    return htmlResponse(html, { status })
  }

  const appRoot = resolvePath(options.root, options.config.app.root)
  const routesDir = resolvePath(options.root, options.config.app.routesDir)
  const routeDir = item?.routeDir

  const closestErrorPage = findClosestErrorPage(appRoot, routesDir, routeDir)
  const displayMessage = (!options.dev && status >= 500) ? "Internal Server Error" : diagnostic.message

  if (closestErrorPage) {
    try {
      const content = readFileSync(closestErrorPage, "utf8")
      const rendered = renderTemplate(content, {
        message: displayMessage,
        status: status,
        route: diagnostic.route,
        phase: diagnostic.phase,
        requestId: requestId
      })
      return htmlResponse(rendered, { status })
    } catch {}
  }

  const html = renderDefaultProductionErrorHtml(displayMessage, status, requestId)
  return htmlResponse(html, { status })
}

function applyResponseHeaders(
  response: Response,
  requestId: string,
  dev: boolean,
  config: ResolvedBoronixConfig
): Response {
  const headers = new Headers(response.headers)
  headers.set("x-boronix-request-id", requestId)

  if (!dev && config.security?.headers) {
    const sh = config.security.headers
    const cto = typeof sh === "object" ? sh.contentTypeOptions : "nosniff"
    const rp = typeof sh === "object" ? sh.referrerPolicy : "strict-origin-when-cross-origin"
    const fo = typeof sh === "object" ? sh.frameOptions : "SAMEORIGIN"

    if (cto) headers.set("X-Content-Type-Options", cto)
    if (rp) headers.set("Referrer-Policy", rp)
    if (fo) headers.set("X-Frame-Options", fo)
  }

  const hasNoBody = [101, 204, 205, 304].includes(response.status)
  return new Response(hasNoBody ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}
