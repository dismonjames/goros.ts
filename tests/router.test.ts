import { expect, test } from "bun:test"
import { matchPath, matchRoute } from "../packages/boronix/src/core/router"
import type { RouteManifest } from "../packages/boronix/src/scanner/route-manifest"

test("matches static routes", () => {
  expect(matchPath("/login", "/login")).toEqual({})
  expect(matchPath("/login", "/logout")).toBeNull()
})

test("matches dynamic routes", () => {
  expect(matchPath("/exercises/:id", "/exercises/123")).toEqual({ id: "123" })
})

test("matches catch-all routes after static and dynamic", () => {
  const manifest: RouteManifest = [
    { kind: "page", routeId: "/files/static", routePath: "/files/static", params: [], routeDir: "" },
    { kind: "page", routeId: "/files/:id", routePath: "/files/:id", params: ["id"], routeDir: "" },
    { kind: "page", routeId: "/files/*slug", routePath: "/files/*slug", params: ["slug"], routeDir: "" }
  ]

  expect(matchRoute(manifest, "/files/static", "page")?.item.routePath).toBe("/files/static")
  expect(matchRoute(manifest, "/files/123", "page")?.params).toEqual({ id: "123" })
  expect(matchRoute(manifest, "/files/a/b", "page")?.params).toEqual({ slug: "a/b" })
})
