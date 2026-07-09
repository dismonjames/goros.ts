import { expect, test } from "bun:test"
import templatePackage from "../packages/create-kumquat/src/templates/basic/package.json" with { type: "json" }
import { existsSync } from "node:fs"
import path from "node:path"

const templateRoot = path.resolve("packages/create-kumquat/src/templates/basic")

test("create template includes route capsules and config", () => {
  expect(existsSync(path.join(templateRoot, "app/routes/home/page.html"))).toBe(true)
  expect(existsSync(path.join(templateRoot, "app/routes/login/actions.ts"))).toBe(true)
  expect(existsSync(path.join(templateRoot, "app/routes/exercises/api.ts"))).toBe(true)
  expect(existsSync(path.join(templateRoot, "kumquat.config.ts"))).toBe(true)
})

test("create template package has runnable scripts", () => {
  expect(templatePackage.scripts.dev).toBe("kumquat dev")
  expect(templatePackage.scripts.build).toBe("kumquat build")
  expect(templatePackage.scripts.start).toBe("kumquat start")
  expect(templatePackage.dependencies.kumquat).toBe("^0.2.1")
})
