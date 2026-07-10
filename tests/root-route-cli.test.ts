import { expect, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const cli = path.resolve("packages/boronix/src/cli/main.ts")

test("routes and inspect report direct root capsule files", () => {
  const root = path.join(os.tmpdir(), `boronix-root-cli-${Date.now()}`)
  mkdirSync(path.join(root, "app", "routes"), { recursive: true })
  writeFileSync(path.join(root, "package.json"), "{}")
  writeFileSync(path.join(root, "app", "routes", "page.html"), "<h1>{{ title }}</h1>")
  writeFileSync(path.join(root, "app", "routes", "page.ts"), 'export default () => ({ title: "Root" })')
  try {
    const routes = Bun.spawnSync({ cmd: ["bun", cli, "routes", "--json"], cwd: root, stdout: "pipe", stderr: "pipe" })
    expect(routes.exitCode).toBe(0)
    const entries = JSON.parse(new TextDecoder().decode(routes.stdout))
    expect(entries).toContainEqual(expect.objectContaining({ path: "/", pattern: "/", kind: "page", file: "app/routes/page.html" }))

    const inspect = Bun.spawnSync({ cmd: ["bun", cli, "inspect", "/", "--json"], cwd: root, stdout: "pipe", stderr: "pipe" })
    expect(inspect.exitCode).toBe(0)
    const result = JSON.parse(new TextDecoder().decode(inspect.stdout))
    expect(result.files.page).toBe("app/routes/page.html")
    expect(result.files.loader).toBe("app/routes/page.ts")
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
