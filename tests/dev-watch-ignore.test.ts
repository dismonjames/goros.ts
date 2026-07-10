import { expect, test } from "bun:test"
import { isIgnoredPath } from "../packages/boronix/src/dev/change-classifier"

test("ignore .boronix directory", () => {
  expect(isIgnoredPath(".boronix/manifest.json")).toBe(true)
  expect(isIgnoredPath(".boronix/types/routes.d.ts")).toBe(true)
})

test("ignore .boronix.tmp directory", () => {
  expect(isIgnoredPath(".boronix.tmp/output.js")).toBe(true)
})

test("ignore node_modules", () => {
  expect(isIgnoredPath("node_modules/boronix/dist/index.js")).toBe(true)
})

test("ignore dist", () => {
  expect(isIgnoredPath("dist/index.js")).toBe(true)
})

test("ignore .git", () => {
  expect(isIgnoredPath(".git/HEAD")).toBe(true)
  expect(isIgnoredPath(".git/refs/heads/main")).toBe(true)
})

test("ignore coverage", () => {
  expect(isIgnoredPath("coverage/lcov.info")).toBe(true)
})

test("ignore drizzle output", () => {
  expect(isIgnoredPath("drizzle/0000_migration.sql")).toBe(true)
})

test("ignore database files", () => {
  expect(isIgnoredPath("local.db")).toBe(true)
  expect(isIgnoredPath("local.db-journal")).toBe(true)
  expect(isIgnoredPath("local.sqlite")).toBe(true)
  expect(isIgnoredPath("local.sqlite3")).toBe(true)
  expect(isIgnoredPath("data.db-wal")).toBe(true)
  expect(isIgnoredPath("data.db-shm")).toBe(true)
})

test("do not ignore app source files", () => {
  expect(isIgnoredPath("app/routes/home/page.html")).toBe(false)
  expect(isIgnoredPath("app/routes/home/page.ts")).toBe(false)
  expect(isIgnoredPath("app/server/auth.ts")).toBe(false)
  expect(isIgnoredPath("app/db/schema.ts")).toBe(false)
})

test("do not ignore public assets", () => {
  expect(isIgnoredPath("public/style.css")).toBe(false)
  expect(isIgnoredPath("public/logo.png")).toBe(false)
})

test("do not ignore config files", () => {
  expect(isIgnoredPath("boronix.config.ts")).toBe(false)
  expect(isIgnoredPath(".env")).toBe(false)
  expect(isIgnoredPath(".env.local")).toBe(false)
})

test("ignore lockfiles", () => {
  expect(isIgnoredPath("bun.lock")).toBe(true)
  expect(isIgnoredPath("package-lock.json")).toBe(true)
  expect(isIgnoredPath("pnpm-lock.yaml")).toBe(true)
  expect(isIgnoredPath("yarn.lock")).toBe(true)
})

test("ignore npm-debug.log", () => {
  expect(isIgnoredPath("npm-debug.log")).toBe(true)
})
