import type { RouteManifest } from "../scanner/route-manifest"

export type BuildManifest = {
  target: "bun" | "node"
  routes: RouteManifest
}
