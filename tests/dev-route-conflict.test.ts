import { expect, test } from "bun:test"
import { devCommand } from "../packages/boronix/src/cli/commands/dev"
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"
import os from "node:os"

function createTempApp(): string {
  const root = path.join(os.tmpdir(), `boronix-conflict-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const routes = path.join(root, "app", "routes", "__boronix", "dev-events")
  mkdirSync(routes, { recursive: true })
  writeFileSync(path.join(routes, "page.html"), "<h1>Conflict</h1>")
  return root
}

test("reserved dev route conflict is detected", async () => {
  const root = createTempApp()

  await expect(devCommand(root, { noColor: true, quiet: true })).rejects.toThrow()

  rmSync(root, { recursive: true, force: true })
})

test("reserved dev route conflict error code is KQ_DEV_ROUTE_CONFLICT", async () => {
  const root = createTempApp()

  try {
    await devCommand(root, { noColor: true, quiet: true })
    expect.unreachable()
  } catch (err: any) {
    expect(err.code).toBe("KQ_DEV_ROUTE_CONFLICT")
  }

  rmSync(root, { recursive: true, force: true })
})
