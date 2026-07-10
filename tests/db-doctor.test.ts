import { expect, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const mainCliPath = path.resolve("packages/boronix/src/cli/main.ts")

test("doctor shows database section when drizzle config exists", () => {
  const tempDir = path.join(os.tmpdir(), `boronix-db-doctor-${Date.now()}`)
  mkdirSync(path.join(tempDir, "app/routes/home"), { recursive: true })
  mkdirSync(path.join(tempDir, "app/db"), { recursive: true })
  mkdirSync(path.join(tempDir, "public"), { recursive: true })
  writeFileSync(path.join(tempDir, "boronix.config.ts"), 'export default { runtime: "bun" }\n', "utf8")
  writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ devDependencies: { "drizzle-kit": "latest" } }, null, 2), "utf8")
  writeFileSync(path.join(tempDir, "drizzle.config.ts"), "export default {}\n", "utf8")
  writeFileSync(path.join(tempDir, "app/routes/home/page.html"), "<h1>Home</h1>\n", "utf8")
  writeFileSync(path.join(tempDir, "app/routes/home/page.ts"), "export default () => ({})\n", "utf8")
  writeFileSync(path.join(tempDir, "app/db/schema.ts"), "export const notes = {}\n", "utf8")
  writeFileSync(path.join(tempDir, "app/db/client.ts"), "export const db = {}\n", "utf8")

  try {
    const result = Bun.spawnSync({
      cmd: ["bun", mainCliPath, "doctor"],
      cwd: tempDir,
      stderr: "pipe",
      stdout: "pipe"
    })
    const stdout = new TextDecoder().decode(result.stdout)
    expect(result.exitCode).toBe(0)
    expect(stdout).toContain("database")
    expect(stdout).toContain("drizzle.config.ts")
    expect(stdout).toContain("app/db/schema.ts")
    expect(stdout).toContain("app/db/client.ts")
    expect(stdout).toContain("drizzle-kit")
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
