import { mkdirSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { expect, test } from "bun:test"
import { build } from "../packages/kumquat/src/build/build"
import { startCommand } from "../packages/kumquat/src/cli/commands/start"

test("missing app routes gives useful build error", async () => {
  const root = path.join(os.tmpdir(), `kumquat-empty-routes-${Date.now()}`)
  mkdirSync(root, { recursive: true })

  await expect(build(root)).rejects.toThrow("No routes found")

  rmSync(root, { recursive: true, force: true })
})

test("missing production manifest gives useful start error", async () => {
  const root = path.join(os.tmpdir(), `kumquat-missing-manifest-${Date.now()}`)
  mkdirSync(root, { recursive: true })

  await expect(startCommand(root)).rejects.toThrow("No production manifest found")

  rmSync(root, { recursive: true, force: true })
})

test("invalid runtime flag gives useful cli error", () => {
  const result = Bun.spawnSync({
    cmd: ["bun", "packages/kumquat/src/cli/main.ts", "dev", "--runtime", "bad"],
    cwd: path.resolve("."),
    stderr: "pipe",
    stdout: "pipe"
  })

  expect(result.exitCode).toBe(1)
  expect(new TextDecoder().decode(result.stderr)).toContain("Kumquat error: Invalid runtime: bad")
})
