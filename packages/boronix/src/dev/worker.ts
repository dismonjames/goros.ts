import path from "node:path"
import { loadConfig } from "../config/load-config"
import { createBoronixApp } from "../core/app"
import { setBoronixMode } from "../core/mode"
import { BoronixUserError } from "../core/errors"
import { scanRoutes } from "../scanner/scan-routes"
import { selectRuntime } from "../runtime/select"
import { resolvePath } from "../utils/path"
import { createDevApp } from "./dev-app"
import { createReloadChannel } from "./reload-channel"
import { encodeDevMessage, type SupervisorToChildMessage } from "./protocol"

type WorkerOptions = {
  root: string
  runtime?: "bun" | "node" | "deno"
  port?: number
  host?: string
  revision: number
  quiet: boolean
  verbose: boolean
  plain: boolean
  noColor: boolean
  reloadEnabled: boolean
}

function parseWorkerOptions(argv: string[]): WorkerOptions {
  const options: WorkerOptions = {
    root: process.cwd(), revision: 1, quiet: false, verbose: false,
    plain: false, noColor: false, reloadEnabled: true
  }
  for (let index = 2; index < argv.length; index++) {
    const value = argv[index]
    const next = argv[index + 1]
    if (value === "--root" && next) { options.root = path.resolve(next); index++ }
    else if (value === "--runtime" && (next === "bun" || next === "node" || next === "deno")) { options.runtime = next; index++ }
    else if (value === "--port" && next) { options.port = Number(next); index++ }
    else if (value === "--host" && next) { options.host = next; index++ }
    else if (value === "--revision" && next) { options.revision = Number(next); index++ }
    else if (value === "--quiet") options.quiet = true
    else if (value === "--verbose") options.verbose = true
    else if (value === "--plain") options.plain = true
    else if (value === "--no-color") options.noColor = true
    else if (value === "--no-reload") options.reloadEnabled = false
  }
  return options
}

function report(message: Parameters<typeof encodeDevMessage>[0]): void {
  process.stdout.write(`${encodeDevMessage(message)}\n`)
}

function routeConflict(manifest: ReturnType<typeof scanRoutes>, reloadEnabled: boolean): void {
  if (!reloadEnabled) return
  for (const item of manifest) {
    if ((item.kind === "page" && item.routePath === "/__boronix/dev-events") ||
      (item.kind === "api" && item.apiPath === "/__boronix/dev-events")) {
      throw new BoronixUserError("The route \"/__boronix/dev-events\" is reserved by the Boronix dev server.", {
        code: "KQ_DEV_ROUTE_CONFLICT",
        hint: "Rename or remove the conflicting route."
      })
    }
  }
}

async function closeServer(server: any): Promise<void> {
  if (typeof server?.stop === "function") {
    server.stop(true)
    return
  }
  if (typeof server?.close === "function") {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

async function main(): Promise<void> {
  const options = parseWorkerOptions(process.argv)
  setBoronixMode("development")
  let server: any
  let channel: ReturnType<typeof createReloadChannel> | undefined
  let stopped = false

  const shutdown = async () => {
    if (stopped) return
    stopped = true
    try { channel?.close() } catch {}
    try { await closeServer(server) } catch {}
    report({ type: "stopped", pid: process.pid, revision: options.revision })
    process.exit(0)
  }

  try {
    const config = await loadConfig(options.root)
    if (options.runtime) config.runtime = options.runtime
    if (options.port !== undefined) config.server.port = options.port
    if (options.host !== undefined) config.server.host = options.host
    const manifest = scanRoutes(resolvePath(options.root, config.app.routesDir))
    if (manifest.length === 0) {
      throw new BoronixUserError("No routes found.", { code: "KQ_ROUTES_MISSING" })
    }
    routeConflict(manifest, options.reloadEnabled)

    const app = options.reloadEnabled
      ? (() => {
          channel = createReloadChannel(options.revision)
          return createDevApp({ root: options.root, config, manifest, channel, quiet: options.quiet, verbose: options.verbose, plain: options.plain })
        })()
      : createBoronixApp({ root: options.root, config, manifest, dev: true, quiet: options.quiet, verbose: options.verbose, plain: options.plain })

    server = selectRuntime(config.runtime).serve({ port: config.server.port, host: config.server.host, fetch: app.fetch })
    report({ type: "ready", pid: process.pid, port: config.server.port, host: config.server.host, revision: options.revision })
  } catch (error: any) {
    report({
      type: "error", pid: process.pid, revision: options.revision,
      code: error?.code,
      message: error instanceof Error ? error.stack ?? error.message : String(error)
    })
    process.exit(1)
  }

  let input = ""
  process.stdin?.setEncoding("utf8")
  process.stdin?.on("data", (chunk: string) => {
    input += chunk
    const lines = input.split(/\r?\n/)
    input = lines.pop() ?? ""
    for (const line of lines) {
      try {
        const message = JSON.parse(line) as SupervisorToChildMessage
        if (message.type === "shutdown") void shutdown()
        if (message.type === "broadcast-reload") {
          channel?.broadcast({
            type: "reload",
            revision: message.revision,
            reason: message.reason,
            ...(message.path ? { path: message.path } : {})
          })
        }
      } catch {}
    }
  })
  process.on("SIGINT", () => void shutdown())
  process.on("SIGTERM", () => void shutdown())
}

void main()
