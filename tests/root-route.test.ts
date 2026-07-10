import { expect, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { scanRoutes } from "../packages/boronix/src/scanner/scan-routes"
import { createBoronixApp } from "../packages/boronix/src/core/app"
import { defaultConfig } from "../packages/boronix/src/config/types"

function appRoot(): string {
  const root = path.join(os.tmpdir(), `boronix-root-route-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(path.join(root, "app", "routes", "home"), { recursive: true })
  writeFileSync(path.join(root, "app", "layout.html"), "<html><body>{{ slot }}</body></html>")
  writeFileSync(path.join(root, "app", "routes", "page.html"), "<h1>{{ title }}</h1>")
  writeFileSync(path.join(root, "app", "routes", "page.ts"), 'export default () => ({ title: "Root page" })')
  writeFileSync(path.join(root, "app", "routes", "home", "page.html"), "<h1>Home folder</h1>")
  return root
}

test("root capsule maps directly to / and home maps to /home", async () => {
  const root = appRoot()
  try {
    const manifest = scanRoutes(path.join(root, "app", "routes"))
    const rootRoute = manifest.find(item => item.kind === "page" && item.routePath === "/")
    const homeRoute = manifest.find(item => item.kind === "page" && item.routePath === "/home")
    expect(rootRoute?.routeId).toBe("/")
    expect(rootRoute?.pageHtml).toBe(path.join(root, "app", "routes", "page.html"))
    expect(homeRoute?.pageHtml).toBe(path.join(root, "app", "routes", "home", "page.html"))

    const app = createBoronixApp({ root, config: defaultConfig, manifest, dev: false })
    const rootHtml = await (await app.fetch(new Request("http://localhost/"))).text()
    const homeHtml = await (await app.fetch(new Request("http://localhost/home"))).text()
    expect(rootHtml).toContain("Root page")
    expect(rootHtml).toContain("<html>")
    expect(homeHtml).toContain("Home folder")
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
