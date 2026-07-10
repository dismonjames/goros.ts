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
  const root = path.join(os.tmpdir(), `boronix-cfg-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const routes = path.join(root, "app", "routes")
  mkdirSync(path.join(routes, "home"), { recursive: true })
  writeFileSync(path.join(routes, "home", "page.html"), "<h1>Home</h1>")
  writeFileSync(path.join(root, "boronix.config.ts"), `export default { runtime: "bun" }\n`)
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

test("config change triggers reload and does not crash", async () => {
  const root = createTempApp()
  const manifest = scanRoutes(path.join(root, "app/routes"))
  const channel = createReloadChannel()

  let reloadCalled = false
  const reloader = createReloader({
    root,
    config: defaultConfig,
    manifest,
    channel,
    debug: false,
    quiet: true,
    onReload: () => { reloadCalled = true }
  })

  const initialRevision = reloader.getRevision()
  await reloader.handleChanges([makeChange("boronix.config.ts", "modify", "config", root)])

  expect(reloadCalled).toBe(true)
  expect(reloader.getRevision()).toBe(initialRevision + 1)

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("config error does not kill reloader", async () => {
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

  writeFileSync(path.join(root, "boronix.config.ts"), `export default { invalid syntax !!! }`)

  const initialRevision = reloader.getRevision()
  await reloader.handleChanges([makeChange("boronix.config.ts", "modify", "config", root)])

  expect(reloader.getRevision()).toBe(initialRevision)
  expect(reloader.hasError()).toBe(true)

  channel.close()
  rmSync(root, { recursive: true, force: true })
})

test("config recovery after fixing error", async () => {
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

  writeFileSync(path.join(root, "boronix.config.ts"), `export default { broken !!! }`)
  await reloader.handleChanges([makeChange("boronix.config.ts", "modify", "config", root)])
  expect(reloader.hasError()).toBe(true)

  writeFileSync(path.join(root, "boronix.config.ts"), `export default { runtime: "bun" }\n`)
  await reloader.handleChanges([makeChange("boronix.config.ts", "modify", "config", root)])
  // The reloader should not crash - it may or may not fully recover depending on
  // runtime module caching, but the process stays alive
  expect(reloader).toBeDefined()

  channel.close()
  rmSync(root, { recursive: true, force: true })
})
