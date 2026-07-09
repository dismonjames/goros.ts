import { expect, test } from "bun:test"
import { rmSync, existsSync, readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const scriptPath = path.resolve("packages/create-boronix/src/index.ts")

test("create-boronix basic template non-interactive", () => {
  const tempDir = path.join(os.tmpdir(), `boronix-nonint-basic-${Date.now()}`)
  const appPath = path.join(tempDir, "my-app")

  try {
    const result = Bun.spawnSync({
      cmd: ["bun", scriptPath, appPath, "--template", "basic", "--runtime", "bun", "--no-install", "--no-git"],
      stderr: "pipe",
      stdout: "pipe"
    })

    expect(result.exitCode).toBe(0)
    expect(existsSync(path.join(appPath, "package.json"))).toBe(true)
    expect(existsSync(path.join(appPath, "boronix.config.ts"))).toBe(true)
    
    const pkg = JSON.parse(readFileSync(path.join(appPath, "package.json"), "utf8"))
    expect(pkg.name).toBe("my-app")
    expect(pkg.dependencies.boronix).toBe("^0.2.7")
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test("create-boronix homework template non-interactive", () => {
  const tempDir = path.join(os.tmpdir(), `boronix-nonint-hw-${Date.now()}`)
  const appPath = path.join(tempDir, "my-app")

  try {
    const result = Bun.spawnSync({
      cmd: ["bun", scriptPath, appPath, "--template", "homework", "--runtime", "node", "--no-install", "--no-git"],
      stderr: "pipe",
      stdout: "pipe"
    })

    expect(result.exitCode).toBe(0)
    expect(existsSync(path.join(appPath, "package.json"))).toBe(true)
    expect(existsSync(path.join(appPath, "boronix.config.ts"))).toBe(true)
    
    const config = readFileSync(path.join(appPath, "boronix.config.ts"), "utf8")
    expect(config).toContain('runtime: "node"')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
