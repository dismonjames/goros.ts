import { expect, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import os from "node:os"
import { createReloadChannel } from "../packages/boronix/src/dev/reload-channel"
import { createReloader } from "../packages/boronix/src/dev/reloader"
import { defaultConfig } from "../packages/boronix/src/config/types"
import { scanRoutes } from "../packages/boronix/src/scanner/scan-routes"
import type { DevFileChange } from "../packages/boronix/src/dev/types"
import { pathToFileURL } from "node:url"

function createTempApp(): string {
  const root = path.join(os.tmpdir(), `boronix-recover-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const routes = path.join(root, "app", "routes", "home")
  mkdirSync(routes, { recursive: true })
  writeFileSync(path.join(routes, "page.html"), "<h1>{{ title }}</h1>")
  const boronixImport = pathToFileURL(path.resolve("packages/boronix/src/index.ts")).href
  writeFileSync(path.join(routes, "page.ts"), `import { page } from '${boronixImport}'; export default page(async () => ({ title: "Home" }))`)
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

test("source error does not kill dev reloader", async () => {
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

  const pageTsPath = path.join(root, "app", "routes", "home", "page.ts")
  writeFileSync(pageTsPath, `export default async () => { throw new Error("broken") }`)

  const initialRevision = reloader.getRevision()
  await reloader.handleChanges([makeChange("app/routes/home/page.ts", "modify", "route-module", root)])

  expect(reloader.getRevision()).toBe(initialRevision + 1)
  expect(reloader.hasError()).toBe(false)

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("fixing source recovers app", async () => {
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

  const pageTsPath = path.join(root, "app", "routes", "home", "page.ts")
  writeFileSync(pageTsPath, `export default async () => { throw new Error("broken") }`)

  await reloader.handleChanges([makeChange("app/routes/home/page.ts", "modify", "route-module", root)])
  expect(reloader.hasError()).toBe(false)

  const boronixImport = pathToFileURL(path.resolve("packages/boronix/src/index.ts")).href
  writeFileSync(pageTsPath, `import { page } from '${boronixImport}'; export default page(async () => ({ title: "Fixed" }))`)

  await reloader.handleChanges([makeChange("app/routes/home/page.ts", "modify", "route-module", root)])
  expect(reloader.hasError()).toBe(false)

  channel.close()
  rmSync(root, { recursive: true, force: true })
})
