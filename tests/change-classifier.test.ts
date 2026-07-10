import { expect, test } from "bun:test"
import { classifyChange, isIgnoredPath, shouldReload } from "../packages/boronix/src/dev/change-classifier"
import type { DevChangeKind } from "../packages/boronix/src/dev/types"

const root = "/home/user/my-app"

function classify(rel: string, event: "create" | "modify" | "remove" | "rename" = "modify") {
  return classifyChange(`${root}/${rel}`, root, event)
}

test("classify page.html as template", () => {
  const result = classify("app/routes/home/page.html")
  expect(result.kind).toBe("template")
})

test("classify layout.html as template", () => {
  const result = classify("app/routes/admin/layout.html")
  expect(result.kind).toBe("template")
})

test("classify app/layout.html as template", () => {
  const result = classify("app/layout.html")
  expect(result.kind).toBe("template")
})

test("classify error.html as template", () => {
  const result = classify("app/error.html")
  expect(result.kind).toBe("template")
})

test("classify not-found.html as template", () => {
  const result = classify("app/not-found.html")
  expect(result.kind).toBe("template")
})

test("classify page.ts as route-module", () => {
  const result = classify("app/routes/home/page.ts")
  expect(result.kind).toBe("route-module")
})

test("classify api.ts as route-module", () => {
  const result = classify("app/routes/exercises/api.ts")
  expect(result.kind).toBe("route-module")
})

test("classify actions.ts as route-module", () => {
  const result = classify("app/routes/login/actions.ts")
  expect(result.kind).toBe("route-module")
})

test("classify app/server file as shared-module", () => {
  const result = classify("app/server/auth.ts")
  expect(result.kind).toBe("shared-module")
})

test("classify app/shared file as shared-module", () => {
  const result = classify("app/shared/format.ts")
  expect(result.kind).toBe("shared-module")
})

test("classify app/db file as shared-module", () => {
  const result = classify("app/db/client.ts")
  expect(result.kind).toBe("shared-module")
})

test("classify public asset as public-asset", () => {
  const result = classify("public/style.css")
  expect(result.kind).toBe("public-asset")
})

test("classify public image as public-asset", () => {
  const result = classify("public/logo.png")
  expect(result.kind).toBe("public-asset")
})

test("classify route directory creation as route-structure", () => {
  const result = classify("app/routes/about", "create")
  expect(result.kind).toBe("route-structure")
})

test("classify boronix.config.ts as config", () => {
  const result = classify("boronix.config.ts")
  expect(result.kind).toBe("config")
})

test("classify drizzle.config.ts as config", () => {
  const result = classify("drizzle.config.ts")
  expect(result.kind).toBe("config")
})

test("classify .env as env", () => {
  const result = classify(".env")
  expect(result.kind).toBe("env")
})

test("classify .env.local as env", () => {
  const result = classify(".env.local")
  expect(result.kind).toBe("env")
})

test("classify middleware.ts in routes as route-module", () => {
  const result = classify("app/routes/admin/middleware.ts")
  expect(result.kind).toBe("route-module")
})

test("classify app/middleware.ts as shared-module", () => {
  const result = classify("app/middleware.ts")
  expect(result.kind).toBe("shared-module")
})

test("ignore node_modules", () => {
  expect(isIgnoredPath("node_modules/foo/bar.ts")).toBe(true)
})

test("ignore .boronix", () => {
  expect(isIgnoredPath(".boronix/manifest.json")).toBe(true)
})

test("ignore .boronix.tmp", () => {
  expect(isIgnoredPath(".boronix.tmp/output.js")).toBe(true)
})

test("ignore dist", () => {
  expect(isIgnoredPath("dist/index.js")).toBe(true)
})

test("ignore .git", () => {
  expect(isIgnoredPath(".git/HEAD")).toBe(true)
})

test("ignore coverage", () => {
  expect(isIgnoredPath("coverage/report.html")).toBe(true)
})

test("ignore drizzle output", () => {
  expect(isIgnoredPath("drizzle/migration.sql")).toBe(true)
})

test("ignore .db files", () => {
  expect(isIgnoredPath("local.db")).toBe(true)
})

test("ignore .sqlite files", () => {
  expect(isIgnoredPath("local.sqlite")).toBe(true)
})

test("ignore .sqlite3 files", () => {
  expect(isIgnoredPath("local.sqlite3")).toBe(true)
})

test("ignore db-journal files", () => {
  expect(isIgnoredPath("local.db-journal")).toBe(true)
})

test("ignore wal files", () => {
  expect(isIgnoredPath("local.db-wal")).toBe(true)
})

test("ignore shm files", () => {
  expect(isIgnoredPath("local.db-shm")).toBe(true)
})

test("ignore lockfiles", () => {
  expect(isIgnoredPath("bun.lock")).toBe(true)
  expect(isIgnoredPath("package-lock.json")).toBe(true)
  expect(isIgnoredPath("pnpm-lock.yaml")).toBe(true)
  expect(isIgnoredPath("yarn.lock")).toBe(true)
})

test("shouldReload returns true for known kinds", () => {
  const kinds: DevChangeKind[] = ["template", "route-module", "shared-module", "public-asset", "route-structure", "config", "env"]
  for (const kind of kinds) {
    expect(shouldReload(kind)).toBe(true)
  }
})

test("shouldReload returns false for unknown", () => {
  expect(shouldReload("unknown")).toBe(false)
})

test("classify unknown file as unknown", () => {
  const result = classify("README.md")
  expect(result.kind).toBe("unknown")
})
