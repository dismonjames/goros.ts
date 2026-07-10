import { expect, test } from "bun:test"
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"

test("boronix package metadata", () => {
  const pkgPath = path.resolve("packages/boronix/package.json")
  expect(existsSync(pkgPath)).toBe(true)

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
  expect(pkg.name).toBe("boronix")
  expect(pkg.version).toBe("0.4.0")
  expect(pkg.license).toBe("MPL-2.0")
  expect(pkg.bin.boronix).toBe("dist/cli/main.js")
  expect(pkg.exports["."].import).toBe("./dist/index.js")
  expect(pkg.exports["."].types).toBe("./dist/index.d.ts")
  expect(pkg.files).toContain("dist")
  expect(pkg.files).toContain("README.md")
  expect(pkg.files).toContain("LICENSE")
})

test("create-boronix package metadata", () => {
  const pkgPath = path.resolve("packages/create-boronix/package.json")
  expect(existsSync(pkgPath)).toBe(true)

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
  expect(pkg.name).toBe("create-boronix")
  expect(pkg.version).toBe("0.4.0")
  expect(pkg.license).toBe("MPL-2.0")
  expect(pkg.bin["create-boronix"]).toBe("dist/index.js")
  expect(pkg.files).toContain("dist")
  expect(pkg.files).toContain("src/templates")
  expect(pkg.files).toContain("README.md")
  expect(pkg.files).toContain("LICENSE")
})
