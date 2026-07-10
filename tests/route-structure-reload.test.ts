import { expect, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import os from "node:os"
import { createReloadChannel } from "../packages/boronix/src/dev/reload-channel"
import { createReloader } from "../packages/boronix/src/dev/reloader"
import { defaultConfig } from "../packages/boronix/src/config/types"
import { scanRoutes } from "../packages/boronix/src/scanner/scan-routes"
import type { DevFileChange } from "../packages/boronix/src/dev/types"

function createTempApp(): string {
  const root = path.join(os.tmpdir(), `boronix-struct-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const routes = path.join(root, "app", "routes")
  mkdirSync(path.join(routes, "home"), { recursive: true })
  writeFileSync(path.join(routes, "home", "page.html"), "<h1>Home</h1>")
  return root
}

function makeChange(rel: string, event: DevFileChange["event"], kind: DevFileChange["kind"], root: string): DevFileChange {
  return {
    event,
    kind,
    absolutePath: path.join(root, rel),
    relativePath: rel,
    detectedAt: Date.now()
  }
}

test("add route updates router", async () => {
  const root = createTempApp()
  const manifest = scanRoutes(path.join(root, "app/routes"))
  const channel = createReloadChannel()

  const reloader = createReloader({
    root,
    config: defaultConfig,
    manifest,
    channel,
    debug: false,
    quiet: true,
    onReload: () => {}
  })

  expect(reloader.getManifest().some(r => r.routePath === "/about")).toBe(false)

  mkdirSync(path.join(root, "app", "routes", "about"), { recursive: true })
  writeFileSync(path.join(root, "app", "routes", "about", "page.html"), "<h1>About</h1>")

  await reloader.handleChanges([makeChange("app/routes/about/page.html", "create", "route-structure", root)])

  expect(reloader.getManifest().some(r => r.routePath === "/about")).toBe(true)

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("delete route updates router to return 404", async () => {
  const root = createTempApp()
  mkdirSync(path.join(root, "app", "routes", "about"), { recursive: true })
  writeFileSync(path.join(root, "app", "routes", "about", "page.html"), "<h1>About</h1>")

  const manifest = scanRoutes(path.join(root, "app/routes"))
  const channel = createReloadChannel()

  const reloader = createReloader({
    root,
    config: defaultConfig,
    manifest,
    channel,
    debug: false,
    quiet: true,
    onReload: () => {}
  })

  expect(reloader.getManifest().some(r => r.routePath === "/about")).toBe(true)

  rmSync(path.join(root, "app", "routes", "about"), { recursive: true, force: true })

  await reloader.handleChanges([makeChange("app/routes/about/page.html", "remove", "route-structure", root)])

  expect(reloader.getManifest().some(r => r.routePath === "/about")).toBe(false)

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("dynamic route add is detected", async () => {
  const root = createTempApp()
  const manifest = scanRoutes(path.join(root, "app/routes"))
  const channel = createReloadChannel()

  const reloader = createReloader({
    root,
    config: defaultConfig,
    manifest,
    channel,
    debug: false,
    quiet: true,
    onReload: () => {}
  })

  mkdirSync(path.join(root, "app", "routes", "users", "[id]"), { recursive: true })
  writeFileSync(path.join(root, "app", "routes", "users", "[id]", "page.html"), "<h1>User {{ id }}</h1>")

  await reloader.handleChanges([makeChange("app/routes/users/[id]/page.html", "create", "route-structure", root)])

  const newManifest = reloader.getManifest()
  expect(newManifest.some(r => r.routePath === "/users/:id")).toBe(true)

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("api file add is detected in route table", async () => {
  const root = createTempApp()
  const manifest = scanRoutes(path.join(root, "app/routes"))
  const channel = createReloadChannel()

  const reloader = createReloader({
    root,
    config: defaultConfig,
    manifest,
    channel,
    debug: false,
    quiet: true,
    onReload: () => {}
  })

  writeFileSync(path.join(root, "app", "routes", "home", "api.ts"), `export const GET = async () => new Response("ok")`)

  await reloader.handleChanges([makeChange("app/routes/home/api.ts", "create", "route-module", root)])

  const newManifest = reloader.getManifest()
  expect(newManifest.some(r => r.kind === "api" && r.apiPath === "/api")).toBe(true)

  channel.close()
  rmSync(root, { recursive: true, force: true })
})
