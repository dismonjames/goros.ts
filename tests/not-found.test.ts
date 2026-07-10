import { expect, test } from "bun:test"
import { writeFileSync, rmSync, mkdirSync } from "node:fs"
import path from "node:path"
import { findClosestNotFound, handleNotFoundResponse } from "../packages/boronix/src/core/app"

test("findClosestNotFound resolves nesting", () => {
  const tempDir = path.resolve(".tmp-nf-test")
  mkdirSync(tempDir, { recursive: true })
  
  const appRoot = path.join(tempDir, "app")
  const routesDir = path.join(appRoot, "routes")
  const subRouteDir = path.join(routesDir, "nested", "path")
  mkdirSync(subRouteDir, { recursive: true })

  const globalNf = path.join(appRoot, "not-found.html")
  const nestedNf = path.join(routesDir, "nested", "not-found.html")

  writeFileSync(globalNf, "global", "utf8")
  writeFileSync(nestedNf, "nested", "utf8")

  try {
    const closest = findClosestNotFound(appRoot, routesDir, subRouteDir)
    expect(closest).toBe(nestedNf)

    const globalResolved = findClosestNotFound(appRoot, routesDir, routesDir)
    expect(globalResolved).toBe(globalNf)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test("handleNotFoundResponse returns 404 response", () => {
  const req = new Request("http://localhost/missing")
  const url = new URL(req.url)
  
  const response = handleNotFoundResponse(req, url, [], {
    root: ".",
    config: {
      runtime: "bun",
      server: { port: 3000, host: "0.0.0.0" },
      app: { root: "app", routesDir: "app/routes", publicDir: "public" },
      session: { name: "kq_session", secret: "123", maxAge: 3600, sameSite: "lax", secure: false },
      cli: { color: true, unicode: true, requestLog: true, groupRoutes: true },
      health: { enabled: false, path: "/health" },
      security: { headers: true },
      dev: { reload: true, watch: { debounce: 50 } }
    }
  })

  expect(response.status).toBe(404)
})
