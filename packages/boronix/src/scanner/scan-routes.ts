import { existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { apiPathFromRoutePath, relativeRouteDir, routeParamsFromDir, routePathFromDir } from "./file-convention"
import type { RouteManifest } from "./route-manifest"

export function scanRoutes(routesDir: string): RouteManifest {
  if (!existsSync(routesDir)) return []

  const routeDirs = collectRouteDirs(routesDir)
  const manifest: RouteManifest = []

  for (const routeDir of routeDirs) {
    const relativeDir = relativeRouteDir(routesDir, routeDir)
    const routePath = routePathFromDir(relativeDir)
    const params = routeParamsFromDir(relativeDir)
    const pageHtml = path.join(routeDir, "page.html")
    const pageModule = path.join(routeDir, "page.ts")
    const apiModule = path.join(routeDir, "api.ts")
    const actionsModule = path.join(routeDir, "actions.ts")

    if (existsSync(pageHtml)) {
      const item = {
        kind: "page" as const,
        routeId: routePath,
        routePath,
        params,
        routeDir,
        pageHtml
      }
      if (existsSync(pageModule)) Object.assign(item, { pageModule })
      if (existsSync(actionsModule)) Object.assign(item, { actionsModule })
      manifest.push(item)
    }

    if (existsSync(apiModule)) {
      const item = {
        kind: "api" as const,
        routeId: routePath,
        routePath,
        apiPath: apiPathFromRoutePath(routePath),
        params,
        routeDir,
        apiModule
      }
      if (existsSync(actionsModule)) Object.assign(item, { actionsModule })
      manifest.push(item)
    }
  }

  return sortManifest(manifest)
}

function collectRouteDirs(dir: string): string[] {
  const dirs: string[] = []
  const entries = readdirSync(dir, { withFileTypes: true })
  const hasRouteFile = entries.some((entry) => entry.isFile() && ["page.html", "api.ts"].includes(entry.name))

  if (hasRouteFile) {
    dirs.push(dir)
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const child = path.join(dir, entry.name)
      if (statSync(child).isDirectory()) {
        dirs.push(...collectRouteDirs(child))
      }
    }
  }

  return dirs
}

function sortManifest(manifest: RouteManifest): RouteManifest {
  return [...manifest].sort((a, b) => routeWeight(a.routePath) - routeWeight(b.routePath))
}

function routeWeight(routePath: string): number {
  return routePath
    .split("/")
    .filter(Boolean)
    .reduce((score, segment) => {
      if (segment.startsWith("*")) return score + 100
      if (segment.startsWith(":")) return score + 10
      return score
    }, 0)
}
