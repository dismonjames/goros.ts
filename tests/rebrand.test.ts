import { expect, test } from "bun:test"
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"

test("package names and CLI commands are rebranded", () => {
  const boronixPkg = JSON.parse(readFileSync("packages/boronix/package.json", "utf8"))
  expect(boronixPkg.name).toBe("boronix")
  expect(boronixPkg.bin.boronix).toBe("dist/cli/main.js")

  const createPkg = JSON.parse(readFileSync("packages/create-boronix/package.json", "utf8"))
  expect(createPkg.name).toBe("create-boronix")
  expect(createPkg.bin["create-boronix"]).toBe("dist/index.js")
})

test("templates config and package scripts reference boronix", () => {
  const basicPkg = JSON.parse(readFileSync("packages/create-boronix/src/templates/basic/package.json", "utf8"))
  expect(basicPkg.scripts.dev).toBe("boronix dev")
  expect(basicPkg.scripts.build).toBe("boronix build")
  expect(basicPkg.scripts.start).toBe("boronix start")
  expect(basicPkg.dependencies.boronix).toBe("^0.2.7")

  const basicConfig = path.resolve("packages/create-boronix/src/templates/basic/boronix.config.ts")
  expect(existsSync(basicConfig)).toBe(true)
})

test("docs, changelog and release notes updated", () => {
  const changelog = readFileSync("CHANGELOG.md", "utf8")
  expect(changelog).toContain("## v0.2.7 - CI Publish Workflow")

  const readme = readFileSync("README.md", "utf8")
  expect(readme).toContain("# Boronix")
  expect(readme).not.toContain("# Kumquat.ts")
})
