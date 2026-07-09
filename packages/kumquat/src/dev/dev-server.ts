import { loadConfig } from "../config/load-config"
import type { ResolvedKumquatConfig } from "../config/types"
import { createKumquatApp } from "../core/app"
import { logRoutes, logServer } from "./logger"
import { selectRuntime } from "../runtime/select"
import { scanRoutes } from "../scanner/scan-routes"
import { resolvePath } from "../utils/path"

export async function startDevServer(root: string, runtimeOverride?: ResolvedKumquatConfig["runtime"]): Promise<void> {
  const config = await loadConfig(root)
  const runtimeName = runtimeOverride ?? config.runtime
  const runtime = selectRuntime(runtimeName)

  const manifest = scanRoutes(resolvePath(root, config.app.routesDir))
  const app = createKumquatApp({ root, config, manifest, dev: true })

  logRoutes(manifest, runtimeName)
  runtime.serve({
    port: config.server.port,
    host: config.server.host,
    fetch: app.fetch
  })
  logServer(config.server.host, config.server.port, runtimeName)
}
