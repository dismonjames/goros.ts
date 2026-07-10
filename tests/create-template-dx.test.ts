import { expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const templateRoot = path.resolve("packages/create-boronix/src/templates/basic")

test("create-boronix template includes error and not-found boundaries", () => {
  expect(existsSync(path.join(templateRoot, "app/error.html"))).toBe(true)
  expect(existsSync(path.join(templateRoot, "app/not-found.html"))).toBe(true)
})

test("create-boronix template package.json has typegen script", () => {
  const pkg = JSON.parse(readFileSync(path.join(templateRoot, "package.json"), "utf8"))
  expect(pkg.scripts.typegen).toBe("boronix typegen")
  expect(pkg.dependencies.boronix).toBe("^0.4.1")
})
