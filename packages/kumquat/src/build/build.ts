import path from "node:path"
import { loadConfig } from "../config/load-config"
import type { ResolvedKumquatConfig } from "../config/types"
import { KumquatUserError } from "../core/errors"
import { scanRoutes } from "../scanner/scan-routes"
import { resolvePath } from "../utils/path"
import { writeBuildOutput } from "./output"

export async function build(root: string, runtimeOverride?: ResolvedKumquatConfig["runtime"]): Promise<void> {
  const config = await loadConfig(root)
  const runtimeName = runtimeOverride ?? config.runtime

  if (runtimeName === "deno") {
    throw new KumquatUserError("Deno runtime is not implemented yet.", {
      hint: "Use `--runtime bun` or `--runtime node`."
    })
  }

  const routesDir = resolvePath(root, config.app.routesDir)
  const routes = scanRoutes(routesDir)
  if (routes.length === 0) {
    throw new KumquatUserError("No routes found.", {
      file: config.app.routesDir,
      hint: "Create at least one route capsule like app/routes/home/page.html."
    })
  }

  writeBuildOutput(root, {
    target: runtimeName,
    routes
  })

  console.log("Kumquat build")
  console.log("")
  console.log(`root: ${root}`)
  console.log(`output: ${path.relative(root, path.join(root, ".kumquat")) || ".kumquat"}`)
  console.log(`routes: ${routes.length}`)
  console.log("status: done")
}
