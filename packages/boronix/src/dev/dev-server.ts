import { loadConfig } from "../config/load-config"
import type { ResolvedBoronixConfig } from "../config/types"
import { createBoronixApp } from "../core/app"
import { BoronixUserError } from "../core/errors"
import { logRoutes, logServer } from "./logger"
import { selectRuntime } from "../runtime/select"
import { scanRoutes } from "../scanner/scan-routes"
import { resolvePath } from "../utils/path"

export async function startDevServer(root: string, runtimeOverride?: ResolvedBoronixConfig["runtime"]): Promise<void> {
  const config = await loadConfig(root)
  const runtimeName = runtimeOverride ?? config.runtime
  const runtime = selectRuntime(runtimeName)

  const manifest = scanRoutes(resolvePath(root, config.app.routesDir))
  if (manifest.length === 0) {
    throw new BoronixUserError("No routes found.", {
      file: config.app.routesDir,
      hint: "Create a route capsule like app/routes/page.html or app/routes/login/page.html."
    })
  }
  const app = createBoronixApp({ root, config, manifest, dev: true })

  logRoutes(manifest, runtimeName, root)
  runtime.serve({
    port: config.server.port,
    host: config.server.host,
    fetch: app.fetch
  })
  logServer(config.server.host, config.server.port, runtimeName)
}
