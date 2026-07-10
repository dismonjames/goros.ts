import { expect, test, beforeAll, afterAll } from "bun:test"
import fs from "node:fs"
import path from "node:path"
import { readBuildManifest, validateBuildManifest } from "../packages/boronix/src/build/manifest"

const tmpManifestDir = path.join(__dirname, "../tmp-manifest-test")

beforeAll(() => {
  if (fs.existsSync(tmpManifestDir)) {
    fs.rmSync(tmpManifestDir, { recursive: true, force: true })
  }
  fs.mkdirSync(tmpManifestDir, { recursive: true })
})

afterAll(() => {
  if (fs.existsSync(tmpManifestDir)) {
    fs.rmSync(tmpManifestDir, { recursive: true, force: true })
  }
})

test("missing manifest throws KQ_BUILD_OUTPUT_NOT_FOUND", () => {
  expect(() => {
    readBuildManifest(tmpManifestDir)
  }).toThrow(/Could not find .boronix\/manifest.json/)
})

test("corrupt manifest JSON throws KQ_BUILD_MANIFEST_INVALID", () => {
  const boronixDir = path.join(tmpManifestDir, ".boronix")
  fs.mkdirSync(boronixDir, { recursive: true })
  fs.writeFileSync(path.join(boronixDir, "manifest.json"), "{invalid JSON", "utf8")

  expect(() => {
    readBuildManifest(tmpManifestDir)
  }).toThrow(/Build manifest is invalid or corrupt/)
})

test("valid manifest loads successfully", () => {
  const boronixDir = path.join(tmpManifestDir, ".boronix")
  const manifestData = {
    version: 1,
    frameworkVersion: "0.6.0",
    createdAt: new Date().toISOString(),
    runtime: "bun",
    mode: "production",
    root: tmpManifestDir,
    routes: [],
    output: {
      directory: ".boronix"
    }
  }
  fs.writeFileSync(path.join(boronixDir, "manifest.json"), JSON.stringify(manifestData), "utf8")

  const loaded = readBuildManifest(tmpManifestDir)
  expect(loaded.version).toBe(1)
  expect(loaded.runtime).toBe("bun")
})

test("runtime mismatch throws KQ_BUILD_RUNTIME_MISMATCH", () => {
  const manifestData = {
    version: 1,
    frameworkVersion: "0.6.0",
    createdAt: new Date().toISOString(),
    runtime: "bun",
    mode: "production",
    root: tmpManifestDir,
    routes: [],
    output: {
      directory: ".boronix"
    }
  }

  expect(() => {
    validateBuildManifest(manifestData, "node")
  }).toThrow(/built for runtime "bun" but is being started with "node"/)
})
