import { expect, test } from "bun:test"
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const mainCliPath = path.resolve("packages/boronix/src/cli/main.ts")

test("db help lists database commands", () => {
  const result = Bun.spawnSync({
    cmd: ["bun", mainCliPath, "db", "--help"],
    stderr: "pipe",
    stdout: "pipe"
  })
  const stdout = new TextDecoder().decode(result.stdout)
  expect(result.exitCode).toBe(0)
  expect(stdout).toContain("boronix db generate")
  expect(stdout).toContain("boronix db migrate")
  expect(stdout).toContain("boronix db push")
  expect(stdout).toContain("boronix db seed")
})

test("db push requires drizzle config before wrapper runs", () => {
  const tempDir = path.join(os.tmpdir(), `boronix-db-cli-no-config-${Date.now()}`)
  mkdirSync(tempDir, { recursive: true })

  try {
    const result = Bun.spawnSync({
      cmd: ["bun", mainCliPath, "db", "push"],
      cwd: tempDir,
      stderr: "pipe",
      stdout: "pipe"
    })
    const stderr = new TextDecoder().decode(result.stderr)
    expect(result.exitCode).toBe(1)
    expect(stderr).toContain("KQ_DB_CONFIG_NOT_FOUND")
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test("db generate reports missing drizzle-kit dependency clearly", () => {
  const tempDir = path.join(os.tmpdir(), `boronix-db-cli-no-kit-${Date.now()}`)
  mkdirSync(tempDir, { recursive: true })
  writeFileSync(path.join(tempDir, "drizzle.config.ts"), "export default {}\n", "utf8")
  writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }, null, 2), "utf8")

  try {
    const result = Bun.spawnSync({
      cmd: ["bun", mainCliPath, "db", "generate"],
      cwd: tempDir,
      stderr: "pipe",
      stdout: "pipe"
    })
    const stderr = new TextDecoder().decode(result.stderr)
    expect(result.exitCode).toBe(1)
    expect(stderr).toContain("KQ_DB_KIT_NOT_FOUND")
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test("db push and generate call local drizzle-kit wrapper", () => {
  const tempDir = path.join(os.tmpdir(), `boronix-db-cli-wrapper-${Date.now()}`)
  mkdirSync(path.join(tempDir, "node_modules/.bin"), { recursive: true })
  writeFileSync(path.join(tempDir, "drizzle.config.ts"), "export default {}\n", "utf8")
  writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ devDependencies: { "drizzle-kit": "latest" } }, null, 2), "utf8")
  const binPath = path.join(tempDir, "node_modules/.bin/drizzle-kit")
  const logPath = path.join(tempDir, "drizzle-call.log")
  writeFileSync(binPath, `#!/usr/bin/env bun\nimport { appendFileSync } from "node:fs"\nappendFileSync("${logPath}", process.argv.slice(2).join(" ") + "\\n")\n`, "utf8")
  chmodSync(binPath, 0o755)

  try {
    const push = Bun.spawnSync({
      cmd: ["bun", mainCliPath, "db", "push"],
      cwd: tempDir,
      stderr: "pipe",
      stdout: "pipe"
    })
    const generate = Bun.spawnSync({
      cmd: ["bun", mainCliPath, "db", "generate"],
      cwd: tempDir,
      stderr: "pipe",
      stdout: "pipe"
    })

    expect(push.exitCode).toBe(0)
    expect(generate.exitCode).toBe(0)
    const log = readFileSync(logPath, "utf8")
    expect(log).toContain("push")
    expect(log).toContain("generate")
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test("db seed reports missing seed file clearly", () => {
  const tempDir = path.join(os.tmpdir(), `boronix-db-cli-no-seed-${Date.now()}`)
  mkdirSync(tempDir, { recursive: true })
  writeFileSync(path.join(tempDir, "drizzle.config.ts"), "export default {}\n", "utf8")

  try {
    const result = Bun.spawnSync({
      cmd: ["bun", mainCliPath, "db", "seed"],
      cwd: tempDir,
      stderr: "pipe",
      stdout: "pipe"
    })
    const stderr = new TextDecoder().decode(result.stderr)
    expect(result.exitCode).toBe(1)
    expect(stderr).toContain("KQ_DB_SEED_NOT_FOUND")
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test("db seed runs app/db/seed.ts", () => {
  const tempDir = path.join(os.tmpdir(), `boronix-db-cli-seed-${Date.now()}`)
  mkdirSync(path.join(tempDir, "app/db"), { recursive: true })
  writeFileSync(path.join(tempDir, "drizzle.config.ts"), "export default {}\n", "utf8")
  writeFileSync(path.join(tempDir, "app/db/seed.ts"), "await Bun.write('seed-ran.txt', 'ok')\n", "utf8")

  try {
    const result = Bun.spawnSync({
      cmd: ["bun", mainCliPath, "db", "seed"],
      cwd: tempDir,
      stderr: "pipe",
      stdout: "pipe"
    })

    expect(result.exitCode).toBe(0)
    expect(existsSync(path.join(tempDir, "seed-ran.txt"))).toBe(true)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
