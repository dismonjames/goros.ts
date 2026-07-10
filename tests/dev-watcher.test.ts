import { expect, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs"
import path from "node:path"
import os from "node:os"
import { createBoronixApp } from "../packages/boronix/src/core/app"
import { createDevApp } from "../packages/boronix/src/dev/dev-app"
import { createReloadChannel } from "../packages/boronix/src/dev/reload-channel"
import { defaultConfig } from "../packages/boronix/src/config/types"
import { scanRoutes } from "../packages/boronix/src/scanner/scan-routes"
import { pathToFileURL } from "node:url"

function createTempApp(): string {
  const root = path.join(os.tmpdir(), `boronix-int-dev-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const routes = path.join(root, "app", "routes", "home")
  mkdirSync(routes, { recursive: true })
  mkdirSync(path.join(root, "public"), { recursive: true })
  writeFileSync(path.join(root, "app", "layout.html"), "<html><body>{{ body }}</body></html>")
  writeFileSync(path.join(routes, "page.html"), "<h1>{{ title }}</h1>")
  const boronixImport = pathToFileURL(path.resolve("packages/boronix/src/index.ts")).href
  writeFileSync(path.join(routes, "page.ts"), `import { page } from '${boronixImport}'; export default page(async () => ({ title: "Home" }))`)
  writeFileSync(path.join(root, "public", "style.css"), "body { color: red; }")
  return root
}

test("dev app injects dev client into HTML", async () => {
  const root = createTempApp()
  const manifest = scanRoutes(path.join(root, "app/routes"))
  const channel = createReloadChannel()

  const devApp = createDevApp({
    root,
    config: defaultConfig,
    manifest,
    channel,
    quiet: true
  })

  const res = await devApp.fetch(new Request("http://localhost/"))
  expect(res.status).toBe(200)
  const html = await res.text()
  expect(html).toContain("data-boronix-dev-client")
  expect(html).toContain("EventSource")
  expect(html).toContain("/__boronix/dev-events")

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("dev app does not inject into JSON API", async () => {
  const root = createTempApp()
  const routes = path.join(root, "app", "routes", "exercises")
  mkdirSync(routes, { recursive: true })
  const boronixImport = pathToFileURL(path.resolve("packages/boronix/src/index.ts")).href
  writeFileSync(path.join(routes, "api.ts"), `import { api, json } from '${boronixImport}'; export const GET = api(async () => json({ ok: true }))`)

  const manifest = scanRoutes(path.join(root, "app/routes"))
  const channel = createReloadChannel()

  const devApp = createDevApp({
    root,
    config: defaultConfig,
    manifest,
    channel,
    quiet: true
  })

  const res = await devApp.fetch(new Request("http://localhost/api/exercises"))
  expect(res.headers.get("content-type")).toContain("application/json")
  const body = await res.text()
  expect(body).not.toContain("data-boronix-dev-client")

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("dev app SSE endpoint returns text/event-stream", async () => {
  const root = createTempApp()
  const manifest = scanRoutes(path.join(root, "app/routes"))
  const channel = createReloadChannel()

  const devApp = createDevApp({
    root,
    config: defaultConfig,
    manifest,
    channel,
    quiet: true
  })

  const res = await devApp.fetch(new Request("http://localhost/__boronix/dev-events"))
  expect(res.status).toBe(200)
  expect(res.headers.get("content-type")).toBe("text/event-stream")

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("dev app does not inject into static assets", async () => {
  const root = createTempApp()
  const manifest = scanRoutes(path.join(root, "app/routes"))
  const channel = createReloadChannel()

  const devApp = createDevApp({
    root,
    config: defaultConfig,
    manifest,
    channel,
    quiet: true
  })

  const res = await devApp.fetch(new Request("http://localhost/style.css"))
  expect(res.headers.get("content-type")).toContain("text/css")
  const body = await res.text()
  expect(body).not.toContain("data-boronix-dev-client")

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("dev app reload swaps manifest and serves new route", async () => {
  const root = createTempApp()
  const manifest = scanRoutes(path.join(root, "app/routes"))
  const channel = createReloadChannel()

  const devApp = createDevApp({
    root,
    config: defaultConfig,
    manifest,
    channel,
    quiet: true
  })

  const aboutRes = await devApp.fetch(new Request("http://localhost/about"))
  expect(aboutRes.status).toBe(404)

  mkdirSync(path.join(root, "app", "routes", "about"), { recursive: true })
  writeFileSync(path.join(root, "app", "routes", "about", "page.html"), "<h1>About</h1>")

  const newManifest = scanRoutes(path.join(root, "app/routes"))
  devApp.reload(newManifest, defaultConfig)

  const aboutRes2 = await devApp.fetch(new Request("http://localhost/about"))
  expect(aboutRes2.status).toBe(200)
  const aboutHtml = await aboutRes2.text()
  expect(aboutHtml).toContain("About")

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("dev app template change: new content appears on next request", async () => {
  const root = createTempApp()
  const manifest = scanRoutes(path.join(root, "app/routes"))
  const channel = createReloadChannel()

  const devApp = createDevApp({
    root,
    config: defaultConfig,
    manifest,
    channel,
    quiet: true
  })

  const res1 = await devApp.fetch(new Request("http://localhost/"))
  const html1 = await res1.text()
  expect(html1).toContain("Home")

  writeFileSync(path.join(root, "app", "routes", "home", "page.html"), "<h1>Changed Content</h1>")

  const res2 = await devApp.fetch(new Request("http://localhost/"))
  const html2 = await res2.text()
  expect(html2).toContain("Changed Content")

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("production app does not inject dev client", async () => {
  const root = createTempApp()
  const manifest = scanRoutes(path.join(root, "app/routes"))

  const app = createBoronixApp({
    root,
    config: defaultConfig,
    manifest,
    dev: false
  })

  const res = await app.fetch(new Request("http://localhost/"))
  const html = await res.text()
  expect(html).not.toContain("data-boronix-dev-client")
  expect(html).not.toContain("EventSource")

  rmSync(root, { recursive: true, force: true })
})

test("production app does not have SSE endpoint", async () => {
  const root = createTempApp()
  const manifest = scanRoutes(path.join(root, "app/routes"))

  const app = createBoronixApp({
    root,
    config: defaultConfig,
    manifest,
    dev: false
  })

  const res = await app.fetch(new Request("http://localhost/__boronix/dev-events"))
  expect(res.status).toBe(404)

  rmSync(root, { recursive: true, force: true })
})
