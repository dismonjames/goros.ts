import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { expect, test } from "bun:test"
import { createBoronixApp } from "../packages/boronix/src/core/app"
import { defaultConfig } from "../packages/boronix/src/config/types"
import { scanRoutes } from "../packages/boronix/src/scanner/scan-routes"

test("serves pages api and dynamic routes", async () => {
  const root = path.join(os.tmpdir(), `boronix-integration-${Date.now()}`)
  const routes = path.join(root, "app", "routes")
  const kumquatImport = pathToFileURL(path.resolve("packages/boronix/src/index.ts")).href

  mkdirSync(routes, { recursive: true })
  mkdirSync(path.join(routes, "exercises", "[id]"), { recursive: true })
  mkdirSync(path.join(root, "public"), { recursive: true })

  writeFileSync(path.join(root, "app", "layout.html"), "<html><body>{{ body }}</body></html>")
  writeFileSync(path.join(routes, "page.html"), "<h1>{{ title }}</h1>")
  writeFileSync(path.join(routes, "page.ts"), `import { page } from '${kumquatImport}'; export default page(async () => ({ title: 'Home' }))`)
  writeFileSync(path.join(routes, "exercises", "api.ts"), `import { api, json } from '${kumquatImport}'; export const GET = api(async () => json({ exercises: [{ id: '1' }] }))`)
  writeFileSync(path.join(routes, "exercises", "[id]", "page.html"), "<h1>{{ id }}</h1>")
  writeFileSync(path.join(routes, "exercises", "[id]", "page.ts"), `import { page } from '${kumquatImport}'; export default page(async ({ params }) => ({ id: params.id }))`)
  writeFileSync(path.join(root, "public", "style.css"), "body { color: black; }")

  const manifest = scanRoutes(routes)
  const app = createBoronixApp({ root, config: defaultConfig, manifest })

  const home = await app.fetch(new Request("http://local/"))
  const api = await app.fetch(new Request("http://local/api/exercises"))
  const detail = await app.fetch(new Request("http://local/exercises/1"))
  const css = await app.fetch(new Request("http://local/style.css"))

  expect(await home.text()).toContain("<h1>Home</h1>")
  expect(await api.json()).toEqual({ exercises: [{ id: "1" }] })
  expect(await detail.text()).toContain("<h1>1</h1>")
  expect(await css.text()).toContain("color: black")

  rmSync(root, { recursive: true, force: true })
})
