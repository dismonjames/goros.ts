import { expect, test, beforeAll, afterAll } from "bun:test"
import fs from "node:fs"
import path from "node:path"
import { startCommand } from "../packages/boronix/src/cli/commands/start"
import { setBoronixMode } from "../packages/boronix/src/core/mode"

const tmpStartDir = path.join(__dirname, "../tmp-start-hardening")

beforeAll(() => {
  if (fs.existsSync(tmpStartDir)) {
    fs.rmSync(tmpStartDir, { recursive: true, force: true })
  }
  fs.mkdirSync(tmpStartDir, { recursive: true })
})

afterAll(() => {
  if (fs.existsSync(tmpStartDir)) {
    fs.rmSync(tmpStartDir, { recursive: true, force: true })
  }
  setBoronixMode("development")
})

test("start command fails if build manifest is missing", async () => {
  expect(
    startCommand(tmpStartDir, { runtime: "bun" })
  ).rejects.toThrow(/Could not find .boronix\/manifest.json/)
})

test("start command fails if runtime mismatch occurs", async () => {
  const boronixDir = path.join(tmpStartDir, ".boronix")
  fs.mkdirSync(boronixDir, { recursive: true })
  const manifestData = {
    version: 1,
    frameworkVersion: "0.6.1",
    createdAt: new Date().toISOString(),
    runtime: "bun",
    mode: "production",
    root: tmpStartDir,
    routes: [],
    output: {
      directory: ".boronix"
    }
  }
  fs.writeFileSync(path.join(boronixDir, "manifest.json"), JSON.stringify(manifestData), "utf8")

  // Try to start with node
  expect(
    startCommand(tmpStartDir, { runtime: "node" })
  ).rejects.toThrow(/This application was built for runtime "bun" but is being started with "node"/)
})
