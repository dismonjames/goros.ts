import type { RouteManifest } from "../scanner/route-manifest"
import type { ResolvedKumquatConfig } from "../config/types"

export function logRoutes(manifest: RouteManifest, runtime: ResolvedKumquatConfig["runtime"]): void {
  console.log("Kumquat dev server")
  console.log(`runtime: ${runtime}`)
  console.log("routes:")

  for (const item of manifest) {
    if (item.kind === "api") {
      console.log(`  GET  ${item.apiPath}  api`)
    } else {
      console.log(`  GET  ${item.routePath.padEnd(18)} page`)
      if (item.actionsModule) {
        console.log(`  POST ${`${item.routePath}?/<action>`.padEnd(18)} action`)
      }
    }
  }
}

export function logServer(host: string, port: number, runtime: ResolvedKumquatConfig["runtime"]): void {
  const localHost = host === "0.0.0.0" ? "localhost" : host
  console.log(`local: http://${localHost}:${port}`)
  console.log(`runtime ${runtime} listening`)
}
