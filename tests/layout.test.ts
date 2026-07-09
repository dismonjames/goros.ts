import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { expect, test } from "bun:test"
import { renderPageView } from "../packages/kumquat/src/render/view"

test("global layout wraps page with raw slot", () => {
  const root = createLayoutApp()
  const appRoot = path.join(root, "app")
  const routesDir = path.join(appRoot, "routes")
  const routeDir = path.join(routesDir, "home")

  mkdirSync(routeDir, { recursive: true })
  writeFileSync(path.join(appRoot, "layout.html"), "<html>{{ slot }}</html>")
  writeFileSync(path.join(routeDir, "page.html"), "<h1>{{ title }}</h1>")

  const html = renderPageView({
    pageHtmlPath: path.join(routeDir, "page.html"),
    appRoot,
    routesDir,
    routeDir,
    data: { title: "<Home>" }
  })

  expect(html).toBe("<html><h1>&lt;Home&gt;</h1></html>")
  rmSync(root, { recursive: true, force: true })
})

test("nested layouts render in parent to child order", () => {
  const root = createLayoutApp()
  const appRoot = path.join(root, "app")
  const routesDir = path.join(appRoot, "routes")
  const routeDir = path.join(routesDir, "dashboard", "settings")

  mkdirSync(routeDir, { recursive: true })
  writeFileSync(path.join(appRoot, "layout.html"), "global({{ slot }})")
  writeFileSync(path.join(routesDir, "dashboard", "layout.html"), "dashboard({{ slot }})")
  writeFileSync(path.join(routeDir, "layout.html"), "settings({{ slot }})")
  writeFileSync(path.join(routeDir, "page.html"), "page")

  const html = renderPageView({
    pageHtmlPath: path.join(routeDir, "page.html"),
    appRoot,
    routesDir,
    routeDir,
    data: {}
  })

  expect(html).toBe("global(dashboard(settings(page)))")
  rmSync(root, { recursive: true, force: true })
})

test("layout without slot does not crash", () => {
  const root = createLayoutApp()
  const appRoot = path.join(root, "app")
  const routesDir = path.join(appRoot, "routes")
  const routeDir = path.join(routesDir, "home")

  mkdirSync(routeDir, { recursive: true })
  writeFileSync(path.join(appRoot, "layout.html"), "<html>No slot</html>")
  writeFileSync(path.join(routeDir, "page.html"), "page")

  const html = renderPageView({
    pageHtmlPath: path.join(routeDir, "page.html"),
    appRoot,
    routesDir,
    routeDir,
    data: {}
  })

  expect(html).toBe("<html>No slot</html>")
  rmSync(root, { recursive: true, force: true })
})

test("layout receives page data", () => {
  const root = createLayoutApp()
  const appRoot = path.join(root, "app")
  const routesDir = path.join(appRoot, "routes")
  const routeDir = path.join(routesDir, "home")

  mkdirSync(routeDir, { recursive: true })
  writeFileSync(path.join(appRoot, "layout.html"), "<title>{{ title }}</title>{{ slot }}")
  writeFileSync(path.join(routeDir, "page.html"), "page")

  const html = renderPageView({
    pageHtmlPath: path.join(routeDir, "page.html"),
    appRoot,
    routesDir,
    routeDir,
    data: { title: "Hello" }
  })

  expect(html).toBe("<title>Hello</title>page")
  rmSync(root, { recursive: true, force: true })
})

function createLayoutApp(): string {
  return path.join(os.tmpdir(), `kumquat-layout-${Date.now()}-${Math.random().toString(16).slice(2)}`)
}
