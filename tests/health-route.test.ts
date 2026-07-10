import { expect, test, beforeAll, afterAll } from "bun:test"
import fs from "node:fs"
import path from "node:path"
import { createBoronixApp } from "../packages/boronix/src/core/app"
import { defaultConfig } from "../packages/boronix/src/config/types"
import { build } from "../packages/boronix/src/build/build"

const tmpProj = path.join(__dirname, "../tmp-health-route-test")

beforeAll(() => {
  if (fs.existsSync(tmpProj)) {
    fs.rmSync(tmpProj, { recursive: true, force: true })
  }
  fs.mkdirSync(tmpProj, { recursive: true })
  fs.mkdirSync(path.join(tmpProj, "app/routes"), { recursive: true })
  fs.writeFileSync(path.join(tmpProj, "app/routes/page.html"), "<h1>Home</h1>", "utf8")
})

afterAll(() => {
  if (fs.existsSync(tmpProj)) {
    fs.rmSync(tmpProj, { recursive: true, force: true })
  }
})

test("health route is disabled by default", async () => {
  const app = createBoronixApp({
    root: tmpProj,
    config: defaultConfig,
    dev: true
  })

  const req = new Request("http://localhost/health")
  const res = await app.fetch(req)
  expect(res.status).toBe(404)
})

test("health route is served when enabled", async () => {
  const app = createBoronixApp({
    root: tmpProj,
    config: {
      ...defaultConfig,
      health: {
        enabled: true,
        path: "/health"
      }
    },
    dev: true
  })

  const req = new Request("http://localhost/health")
  const res = await app.fetch(req)
  expect(res.status).toBe(200)

  const json = await res.json()
  expect(json).toEqual({
    status: "ok",
    framework: "boronix",
    version: "0.6.1"
  })
})

test("health route conflict during build is blocked", async () => {
  // Write a route matching the health check path AND a config that enables health check
  fs.mkdirSync(path.join(tmpProj, "app/routes/health"), { recursive: true })
  fs.writeFileSync(path.join(tmpProj, "app/routes/health/page.html"), "<h1>Health</h1>", "utf8")
  fs.writeFileSync(path.join(tmpProj, "boronix.config.ts"), `
import { defineConfig } from "${path.join(__dirname, "../packages/boronix/src/index.ts")}"
export default defineConfig({ health: { enabled: true, path: "/health" } })
  `, "utf8")

  try {
    const { build } = await import("../packages/boronix/src/build/build")
    await expect(build(tmpProj, "bun")).rejects.toThrow()
  } finally {
    // Cleanup route and config
    fs.rmSync(path.join(tmpProj, "app/routes/health"), { recursive: true, force: true })
    fs.rmSync(path.join(tmpProj, "boronix.config.ts"), { force: true })
  }
})
