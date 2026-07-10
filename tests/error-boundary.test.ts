import { expect, test } from "bun:test"
import { writeFileSync, rmSync, mkdirSync } from "node:fs"
import path from "node:path"
import { findClosestErrorPage, handleDevOrErrorPageResponse } from "../packages/boronix/src/core/app"

test("findClosestErrorPage resolves nesting", () => {
  const tempDir = path.resolve(".tmp-err-test")
  mkdirSync(tempDir, { recursive: true })
  
  const appRoot = path.join(tempDir, "app")
  const routesDir = path.join(appRoot, "routes")
  const subRouteDir = path.join(routesDir, "nested", "path")
  mkdirSync(subRouteDir, { recursive: true })

  const globalErr = path.join(appRoot, "error.html")
  const nestedErr = path.join(routesDir, "nested", "error.html")

  writeFileSync(globalErr, "global", "utf8")
  writeFileSync(nestedErr, "nested", "utf8")

  try {
    const closest = findClosestErrorPage(appRoot, routesDir, subRouteDir)
    expect(closest).toBe(nestedErr)

    const globalResolved = findClosestErrorPage(appRoot, routesDir, routesDir)
    expect(globalResolved).toBe(globalErr)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test("handleDevOrErrorPageResponse returns 500 response without leak in prod", () => {
  const req = new Request("http://localhost/crash")
  const url = new URL(req.url)
  
  const response = handleDevOrErrorPageResponse(
    new Error("Secret database credentials leak!"),
    "page-loader",
    req,
    url,
    [],
    {
      root: ".",
      dev: false,
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
    }
  )

  expect(response.status).toBe(500)
  
  // Production should not expose secret stack
  response.text().then(text => {
    expect(text).not.toContain("Secret database credentials leak!")
  })
})

test("handleDevOrErrorPageResponse uses polished dev overlay in dev mode", async () => {
  const req = new Request("http://localhost/crash")
  const url = new URL(req.url)

  const response = handleDevOrErrorPageResponse(
    new Error("Cannot read properties of undefined"),
    "page-loader",
    req,
    url,
    [],
    {
      root: ".",
      dev: true,
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
    }
  )

  const html = await response.text()
  expect(response.status).toBe(500)
  expect(html).toContain("Boronix Dev Overlay")
  expect(html).toContain("source-box")
  expect(html).toContain("Cannot read properties of undefined")
})
