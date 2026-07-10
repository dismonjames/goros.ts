import path from "node:path"
import { loadConfig } from "../config/load-config"
import type { ResolvedBoronixConfig } from "../config/types"
import { BoronixUserError } from "../core/errors"
import { scanRoutes } from "../scanner/scan-routes"
import { resolvePath } from "../utils/path"
import { writeBuildOutput } from "./output"

export async function build(root: string, runtimeOverride?: ResolvedBoronixConfig["runtime"]): Promise<void> {
  const config = await loadConfig(root)
  const runtimeName = runtimeOverride ?? config.runtime

  if (runtimeName === "deno") {
    throw new BoronixUserError("Deno runtime is not implemented yet.", {
      hint: "Use `--runtime bun` or `--runtime node`."
    })
  }

  const routesDir = resolvePath(root, config.app.routesDir)
  const routes = scanRoutes(routesDir)
  
  if (config.health?.enabled) {
    const conflict = routes.find(r => r.routePath === config.health.path)
    if (conflict) {
      throw new BoronixUserError(`Health check route path "${config.health.path}" conflicts with an application route.`, {
        code: "KQ_HEALTH_ROUTE_CONFLICT",
        hint: "Change health.path in boronix.config.ts or remove the conflicting route capsule."
      })
    }
  }

  if (routes.length === 0) {
    throw new BoronixUserError("No routes found.", {
      file: config.app.routesDir,
      hint: "Create at least one route capsule like app/routes/home/page.html."
    })
  }

  const resolvedRoot = path.resolve(root)
  writeBuildOutput(root, {
    version: 1,
    frameworkVersion: "0.6.0",
    createdAt: new Date().toISOString(),
    runtime: runtimeName as "bun" | "node",
    mode: "production",
    root: resolvedRoot,
    routes,
    output: {
      directory: ".boronix"
    }
  })

  console.log("Boronix build")
  console.log("")
  console.log(`root: ${root}`)
  console.log(`output: ${path.relative(root, path.join(root, ".boronix")) || ".boronix"}`)
  console.log(`routes: ${routes.length}`)
  console.log("status: done")
}
