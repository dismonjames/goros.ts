import { expect, test } from "bun:test"
import templatePackage from "../packages/create-boronix/src/templates/basic/package.json" with { type: "json" }
import { existsSync } from "node:fs"
import path from "node:path"

const templateRoot = path.resolve("packages/create-boronix/src/templates/basic")

test("create template includes route capsules and config", () => {
  expect(existsSync(path.join(templateRoot, "app/routes/home/page.html"))).toBe(true)
  expect(existsSync(path.join(templateRoot, "app/routes/login/actions.ts"))).toBe(true)
  expect(existsSync(path.join(templateRoot, "app/routes/exercises/api.ts"))).toBe(true)
  expect(existsSync(path.join(templateRoot, "boronix.config.ts"))).toBe(true)
})

test("create template package has runnable scripts", () => {
  expect(templatePackage.scripts.dev).toBe("boronix dev")
  expect(templatePackage.scripts.build).toBe("boronix build")
  expect(templatePackage.scripts.start).toBe("boronix start")
  expect(templatePackage.dependencies.boronix).toBe("^0.6.0")
})
