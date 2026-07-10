import { expect, test, beforeAll, afterAll } from "bun:test"
import fs from "node:fs"
import path from "node:path"
import { writeBuildOutput } from "../packages/boronix/src/build/output"

const tmpBuildDir = path.join(__dirname, "../tmp-build-atomic")

beforeAll(() => {
  if (fs.existsSync(tmpBuildDir)) {
    fs.rmSync(tmpBuildDir, { recursive: true, force: true })
  }
  fs.mkdirSync(tmpBuildDir, { recursive: true })
})

afterAll(() => {
  if (fs.existsSync(tmpBuildDir)) {
    fs.rmSync(tmpBuildDir, { recursive: true, force: true })
  }
})

test("successful build writes and atomic replacement works", () => {
  const manifest1 = {
    version: 1 as const,
    frameworkVersion: "0.6.0",
    createdAt: new Date().toISOString(),
    runtime: "bun" as const,
    mode: "production" as const,
    root: tmpBuildDir,
    routes: [],
    output: {
      directory: ".boronix"
    }
  }

  writeBuildOutput(tmpBuildDir, manifest1)

  const manifestPath = path.join(tmpBuildDir, ".boronix", "manifest.json")
  expect(fs.existsSync(manifestPath)).toBe(true)

  const loaded = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  expect(loaded.version).toBe(1)

  // Write second build
  const manifest2 = {
    ...manifest1,
    createdAt: "new-time"
  }
  writeBuildOutput(tmpBuildDir, manifest2)

  const loaded2 = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  expect(loaded2.createdAt).toBe("new-time")
})

test("failed build does not destroy old build output", () => {
  const manifestPath = path.join(tmpBuildDir, ".boronix", "manifest.json")
  expect(fs.existsSync(manifestPath)).toBe(true)

  const oldContent = fs.readFileSync(manifestPath, "utf8")

  // Attempt to write an invalid manifest (which should fail validation)
  const invalidManifest = {
    version: 99 as any, // invalid version
    frameworkVersion: "0.6.0",
    createdAt: new Date().toISOString(),
    runtime: "bun" as const,
    mode: "production" as const,
    root: tmpBuildDir,
    routes: [],
    output: {
      directory: ".boronix"
    }
  }

  expect(() => {
    writeBuildOutput(tmpBuildDir, invalidManifest)
  }).toThrow()

  // Verify old manifest is still intact
  const newContent = fs.readFileSync(manifestPath, "utf8")
  expect(newContent).toBe(oldContent)
})
