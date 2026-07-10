import { expect, test, beforeAll, afterAll } from "bun:test"
import fs from "node:fs"
import path from "node:path"

const mainCliPath = path.resolve("packages/boronix/src/cli/main.ts")
const tmpDocDir = path.join(__dirname, "../tmp-doctor-production-test")

beforeAll(() => {
  if (fs.existsSync(tmpDocDir)) {
    fs.rmSync(tmpDocDir, { recursive: true, force: true })
  }
  fs.mkdirSync(tmpDocDir, { recursive: true })
  fs.writeFileSync(path.join(tmpDocDir, "package.json"), "{}", "utf8")
  fs.writeFileSync(path.join(tmpDocDir, "boronix.config.ts"), `
import { defineConfig } from "boronix"
export default defineConfig({ runtime: "bun" })
  `, "utf8")
  fs.mkdirSync(path.join(tmpDocDir, "app/routes"), { recursive: true })
  fs.writeFileSync(path.join(tmpDocDir, "app/routes/page.html"), "<h1>Home</h1>", "utf8")
  fs.mkdirSync(path.join(tmpDocDir, "public"), { recursive: true })
})

afterAll(() => {
  if (fs.existsSync(tmpDocDir)) {
    fs.rmSync(tmpDocDir, { recursive: true, force: true })
  }
})

test("doctor --production detects missing build output", () => {
  const result = Bun.spawnSync({
    cmd: ["bun", mainCliPath, "doctor", "--production", "--plain"],
    cwd: tmpDocDir,
    stderr: "pipe",
    stdout: "pipe"
  })

  expect(result.exitCode).toBe(1) // Fails due to missing build manifest

  const stdout = new TextDecoder().decode(result.stdout)
  expect(stdout).toContain("production")
  expect(stdout).toContain("build manifest")
})

test("doctor --production passes after valid build manifest exists", () => {
  const boronixDir = path.join(tmpDocDir, ".boronix")
  fs.mkdirSync(boronixDir, { recursive: true })
  const manifestData = {
    version: 1,
    frameworkVersion: "0.6.0",
    createdAt: new Date().toISOString(),
    runtime: "bun",
    mode: "production",
    root: tmpDocDir,
    routes: [
      {
        kind: "page",
        routePath: "/",
        params: [],
        routeDir: "app/routes"
      }
    ],
    output: {
      directory: ".boronix"
    }
  }
  fs.writeFileSync(path.join(boronixDir, "manifest.json"), JSON.stringify(manifestData), "utf8")

  const result = Bun.spawnSync({
    cmd: ["bun", mainCliPath, "doctor", "--production", "--plain"],
    cwd: tmpDocDir,
    stderr: "pipe",
    stdout: "pipe"
  })

  const stdout = new TextDecoder().decode(result.stdout)
  expect(result.exitCode).toBe(0) // Passes successfully now!
  expect(stdout).toContain("project looks healthy")
})
