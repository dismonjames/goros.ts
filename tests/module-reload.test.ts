import { expect, test } from "bun:test"
import { createReloadChannel } from "../packages/boronix/src/dev/reload-channel"
import { createReloader } from "../packages/boronix/src/dev/reloader"
import { defaultConfig } from "../packages/boronix/src/config/types"
import type { RouteManifest } from "../packages/boronix/src/scanner/route-manifest"
import type { DevFileChange } from "../packages/boronix/src/dev/types"
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"
import os from "node:os"
import { scanRoutes } from "../packages/boronix/src/scanner/scan-routes"

function createTempApp(): string {
  const root = path.join(os.tmpdir(), `boronix-reload-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const routes = path.join(root, "app", "routes")
  mkdirSync(path.join(routes, "home"), { recursive: true })
  mkdirSync(path.join(root, "public"), { recursive: true })
  writeFileSync(path.join(routes, "home", "page.html"), "<h1>{{ title }}</h1>")
  writeFileSync(path.join(routes, "home", "page.ts"), `export default async () => ({ title: "Home" })`)
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

test("reloader increments revision on template change", async () => {
  const root = createTempApp()
  const manifest = scanRoutes(path.join(root, "app/routes"))
  const channel = createReloadChannel()
  let reloadedManifest: RouteManifest | null = null
  let reloadedRevision = 0

  const reloader = createReloader({
    root,
    config: defaultConfig,
    manifest,
    channel,
    debug: false,
    quiet: true,
    onReload: (m, _c, r) => {
      reloadedManifest = m
      reloadedRevision = r
    }
  })

  const initialRevision = reloader.getRevision()
  await reloader.handleChanges([makeChange("app/routes/home/page.html", "modify", "template", root)])

  expect(reloader.getRevision()).toBe(initialRevision + 1)
  expect(reloadedRevision).toBe(initialRevision + 1)

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("reloader rescans routes on route-structure change", async () => {
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

  mkdirSync(path.join(root, "app", "routes", "about"), { recursive: true })
  writeFileSync(path.join(root, "app", "routes", "about", "page.html"), "<h1>About</h1>")

  await reloader.handleChanges([makeChange("app/routes/about/page.html", "create", "route-structure", root)])

  const newManifest = reloader.getManifest()
  expect(newManifest.some(r => r.routePath === "/about")).toBe(true)

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("reloader handles route removal", async () => {
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

  rmSync(path.join(root, "app", "routes", "about"), { recursive: true, force: true })

  await reloader.handleChanges([makeChange("app/routes/about/page.html", "remove", "route-structure", root)])

  const newManifest = reloader.getManifest()
  expect(newManifest.some(r => r.routePath === "/about")).toBe(false)

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("reloader does not crash on unknown changes", async () => {
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

  const initialRevision = reloader.getRevision()
  await reloader.handleChanges([makeChange("README.md", "modify", "unknown", root)])
  expect(reloader.getRevision()).toBe(initialRevision)

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("reloader broadcasts reload event via channel", async () => {
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

  const sseRes = channel.handleSSE(new Request("http://localhost/__boronix/dev-events"))
  const reader = sseRes.body!.getReader()
  await reader.read()

  await reloader.handleChanges([makeChange("app/routes/home/page.html", "modify", "template", root)])

  const chunk = await reader.read()
  const text = new TextDecoder().decode(chunk.value)
  expect(text).toContain("reload")

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("reloader does not send absolute path in reload event", async () => {
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

  const sseRes = channel.handleSSE(new Request("http://localhost/__boronix/dev-events"))
  const reader = sseRes.body!.getReader()
  await reader.read()

  await reloader.handleChanges([makeChange("app/routes/home/page.html", "modify", "template", root)])

  const chunk = await reader.read()
  const text = new TextDecoder().decode(chunk.value)
  expect(text).not.toContain(root)
  expect(text).not.toContain(os.tmpdir())

  channel.close()
  rmSync(root, { recursive: true, force: true })
})
