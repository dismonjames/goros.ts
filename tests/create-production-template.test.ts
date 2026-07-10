import { expect, test } from "bun:test"
import fs from "node:fs"
import path from "node:path"

const basicTemplateDir = path.join(__dirname, "../packages/create-boronix/src/templates/basic")
const homeworkTemplateDir = path.join(__dirname, "../packages/create-boronix/src/templates/homework")

test("basic template contains correct package version and scripts", () => {
  const pkgPath = path.join(basicTemplateDir, "package.json")
  expect(fs.existsSync(pkgPath)).toBe(true)

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
  expect(pkg.dependencies.boronix).toBe("^0.6.1")
  expect(pkg.scripts["doctor:production"]).toBe("boronix doctor --production")
})

test("homework template contains correct package version and env.example", () => {
  const pkgPath = path.join(homeworkTemplateDir, "package.json")
  expect(fs.existsSync(pkgPath)).toBe(true)

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
  expect(pkg.dependencies.boronix).toBe("^0.6.1")
  expect(pkg.scripts["doctor:production"]).toBe("boronix doctor --production")

  const envExPath = path.join(homeworkTemplateDir, ".env.example")
  expect(fs.existsSync(envExPath)).toBe(true)
  const envExContent = fs.readFileSync(envExPath, "utf8")
  expect(envExContent).toContain("BORONIX_SESSION_SECRET")
})
