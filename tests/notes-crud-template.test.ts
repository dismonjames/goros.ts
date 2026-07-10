import { expect, test } from "bun:test"
import { existsSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const scriptPath = path.resolve("packages/create-boronix/src/index.ts")

test("notes route files exist when selecting database template", () => {
  const tempDir = path.join(os.tmpdir(), `boronix-notes-template-${Date.now()}`)
  const appPath = path.join(tempDir, "my-app")

  try {
    const result = Bun.spawnSync({
      cmd: ["bun", scriptPath, appPath, "--template", "basic", "--runtime", "bun", "--db", "sqlite", "--no-install", "--no-git"],
      stderr: "pipe",
      stdout: "pipe"
    })

    expect(result.exitCode).toBe(0)
    expect(existsSync(path.join(appPath, "app/routes/notes/page.html"))).toBe(true)
    expect(existsSync(path.join(appPath, "app/routes/notes/page.ts"))).toBe(true)
    expect(existsSync(path.join(appPath, "app/routes/notes/actions.ts"))).toBe(true)
    expect(readFileSync(path.join(appPath, "app/routes/notes/page.ts"), "utf8")).toContain("orderBy(desc(notes.id))")
    const actions = readFileSync(path.join(appPath, "app/routes/notes/actions.ts"), "utf8")
    expect(actions).toContain('Number(form.string("id"))')
    expect(actions).toContain("db.delete(notes)")
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
