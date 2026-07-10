import { expect, test } from "bun:test"
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"

test("create template has dev script", () => {
  const basicPkg = JSON.parse(readFileSync(
    path.resolve("packages/create-boronix/src/templates/basic/package.json"),
    "utf8"
  ))
  expect(basicPkg.scripts.dev).toBe("boronix dev")
})

test("create template uses ^0.6.0 for boronix", () => {
  const basicPkg = JSON.parse(readFileSync(
    path.resolve("packages/create-boronix/src/templates/basic/package.json"),
    "utf8"
  ))
  expect(basicPkg.dependencies.boronix).toBe("^0.6.0")

  const hwPkg = JSON.parse(readFileSync(
    path.resolve("packages/create-boronix/src/templates/homework/package.json"),
    "utf8"
  ))
  expect(hwPkg.dependencies.boronix).toBe("^0.6.0")
})

test("create template has no separate dev client package", () => {
  const basicPkg = JSON.parse(readFileSync(
    path.resolve("packages/create-boronix/src/templates/basic/package.json"),
    "utf8"
  ))
  expect(basicPkg.dependencies).not.toHaveProperty("boronix-dev-client")
  expect(basicPkg.dependencies).not.toHaveProperty("@boronix/dev-client")
})

test("create template does not have dev client file", () => {
  const basicDevClient = path.resolve("packages/create-boronix/src/templates/basic/dev-client.js")
  expect(existsSync(basicDevClient)).toBe(false)

  const hwDevClient = path.resolve("packages/create-boronix/src/templates/homework/dev-client.js")
  expect(existsSync(hwDevClient)).toBe(false)
})

test("create template boronix.config.ts supports dev config", () => {
  const basicConfig = readFileSync(
    path.resolve("packages/create-boronix/src/templates/basic/boronix.config.ts"),
    "utf8"
  )
  expect(basicConfig).toContain("defineConfig")
})
