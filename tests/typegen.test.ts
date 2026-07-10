import { expect, test } from "bun:test"
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const mainCliPath = path.resolve("packages/boronix/src/cli/main.ts")

test("typegen command generates route types file", () => {
  const tempDir = path.join(os.tmpdir(), `boronix-typegen-${Date.now()}`)
  
  try {
    mkdirSync(tempDir, { recursive: true })
    writeFileSync(path.join(tempDir, "package.json"), "{}", "utf8")
    writeFileSync(path.join(tempDir, "boronix.config.ts"), 'export default { runtime: "bun" };', "utf8")
    
    // Create routes capsules
    mkdirSync(path.join(tempDir, "app/routes"), { recursive: true })
    writeFileSync(path.join(tempDir, "app/routes/page.html"), "Home page", "utf8")

    mkdirSync(path.join(tempDir, "app/routes/exercises/[id]"), { recursive: true })
    writeFileSync(path.join(tempDir, "app/routes/exercises/[id]/page.html"), "Exercise page", "utf8")

    mkdirSync(path.join(tempDir, "app/routes/exercises"), { recursive: true })
    writeFileSync(path.join(tempDir, "app/routes/exercises/api.ts"), "export const GET = () => {}", "utf8")

    mkdirSync(path.join(tempDir, "app/routes/login"), { recursive: true })
    writeFileSync(path.join(tempDir, "app/routes/login/page.html"), "Login page", "utf8")
    writeFileSync(path.join(tempDir, "app/routes/login/actions.ts"), "export const login = () => {}", "utf8")

    const result = Bun.spawnSync({
      cmd: ["bun", mainCliPath, "typegen"],
      cwd: tempDir,
      stderr: "pipe",
      stdout: "pipe"
    })

    expect(result.exitCode).toBe(0)
    
    const typesFile = path.join(tempDir, ".boronix/types/routes.d.ts")
    expect(existsSync(typesFile)).toBe(true)

    const content = readFileSync(typesFile, "utf8")
    
    // Page routes
    expect(content).toContain('export type PageRoute =')
    expect(content).toContain('"/"')
    expect(content).toContain('`/exercises/${string}`')

    // Api routes
    expect(content).toContain('export type ApiRoute =')
    expect(content).toContain('"/api/exercises"')

    // Action routes
    expect(content).toContain('export type ActionRoute =')
    expect(content).toContain('"/login?/login"')

    // BoronixRoute & BoronixRouteParams
    expect(content).toContain('export type BoronixRoute =')
    expect(content).toContain('"/exercises/[id]"')
    expect(content).toContain('export type BoronixRouteParams =')
    expect(content).toContain('id: string')
    expect(content).toContain('export type RouteParams<T extends BoronixRoute>')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
