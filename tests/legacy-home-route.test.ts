import { expect, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

test("doctor warns that a legacy home capsule now maps to /home", () => {
  const root = path.join(os.tmpdir(), `boronix-legacy-home-${Date.now()}`)
  mkdirSync(path.join(root, "app", "routes", "home"), { recursive: true })
  mkdirSync(path.join(root, "public"), { recursive: true })
  writeFileSync(path.join(root, "package.json"), "{}")
  writeFileSync(path.join(root, "boronix.config.ts"), "export default {}")
  writeFileSync(path.join(root, "app", "routes", "home", "page.html"), "<h1>Home</h1>")
  try {
    const result = Bun.spawnSync({
      cmd: ["bun", path.resolve("packages/boronix/src/cli/main.ts"), "doctor", "--plain"],
      cwd: root,
      stdout: "pipe",
      stderr: "pipe"
    })
    expect(result.exitCode).toBe(0)
    expect(new TextDecoder().decode(result.stdout)).toContain("KQ_LEGACY_HOME_ROUTE")
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
