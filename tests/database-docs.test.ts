import { expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

test("database docs include Drizzle tutorial and CLI flow", () => {
  const docs = [
    "docs/database.md",
    "docs/database-sqlite.md",
    "docs/database-postgres.md",
    "docs/database-cli.md",
    "docs/tutorial-database.md"
  ]

  for (const doc of docs) {
    expect(existsSync(path.resolve(doc))).toBe(true)
  }

  const tutorial = readFileSync("docs/tutorial-database.md", "utf8")
  expect(tutorial).toContain("npx create-boronix")
  expect(tutorial).toContain("--db sqlite")
  expect(tutorial).toContain("bun run db:push")

  const overview = readFileSync("docs/database.md", "utf8")
  expect(overview).toContain("Boronix does not ship an ORM")
  expect(overview).toContain("Drizzle")
})
