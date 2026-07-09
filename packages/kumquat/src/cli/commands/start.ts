import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { loadConfig } from "../../config/load-config"
import type { ResolvedKumquatConfig } from "../../config/types"
import { createKumquatApp } from "../../core/app"
import { KumquatUserError } from "../../core/errors"
import { selectRuntime } from "../../runtime/select"
import type { BuildManifest } from "../../build/manifest"

export async function startCommand(root: string, runtimeOverride?: ResolvedKumquatConfig["runtime"]): Promise<void> {
  const manifestPath = path.join(root, ".kumquat", "manifest.json")

  if (!existsSync(manifestPath)) {
    throw new KumquatUserError("No production manifest found.", {
      hint: "Run `kumquat build` first."
    })
  }

  const config = await loadConfig(root)
  const runtimeName = runtimeOverride ?? config.runtime
  const runtime = selectRuntime(runtimeName)
  const buildManifest = JSON.parse(readFileSync(manifestPath, "utf8")) as BuildManifest
  const app = createKumquatApp({ root, config, manifest: buildManifest.routes })

  runtime.serve({
    port: config.server.port,
    host: config.server.host,
    fetch: app.fetch
  })

  console.log(`Kumquat server listening on http://${config.server.host}:${config.server.port} with ${runtimeName}`)
}
