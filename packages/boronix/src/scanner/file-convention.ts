import path from "node:path"
import { toPosixPath } from "../utils/path"

export function routePathFromDir(relativeDir: string): string {
  const segments = toPosixPath(relativeDir).split("/").filter(Boolean)
  return `/${segments.map(convertSegment).join("/")}`.replace(/\/+$/, "") || "/"
}

export function apiPathFromRoutePath(routePath: string): string {
  if (routePath === "/") return "/api"
  return `/api${routePath}`
}

export function routeParamsFromDir(relativeDir: string): string[] {
  return toPosixPath(relativeDir)
    .split("/")
    .filter(Boolean)
    .flatMap((segment) => {
      if (segment.startsWith("[...") && segment.endsWith("]")) {
        return [segment.slice(4, -1)]
      }
      if (segment.startsWith("[") && segment.endsWith("]")) {
        return [segment.slice(1, -1)]
      }
      return []
    })
}

export function relativeRouteDir(routesDir: string, routeDir: string): string {
  return toPosixPath(path.relative(routesDir, routeDir))
}

function convertSegment(segment: string): string {
  if (segment.startsWith("[...") && segment.endsWith("]")) {
    return `*${segment.slice(4, -1)}`
  }
  if (segment.startsWith("[") && segment.endsWith("]")) {
    return `:${segment.slice(1, -1)}`
  }
  return segment
}
