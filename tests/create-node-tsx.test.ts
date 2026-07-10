import { expect, test } from "bun:test"
import { mkdirSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

test("create-boronix adds project-local tsx for Node runtime", async () => {
  const root = path.join(os.tmpdir(), `boronix-node-tsx-${Date.now()}`)
  mkdirSync(root, { recursive: true })
  try {
    const project = "node-app"
    const proc = Bun.spawn({
      cmd: [process.execPath, "run", path.resolve("packages/create-boronix/src/index.ts"), path.join(root, project), "--runtime", "node", "--db", "none", "--no-install", "--no-git"],
      cwd: root,
      stdout: "ignore",
      stderr: "ignore"
    })
    expect(await proc.exited).toBe(0)
    const pkg = JSON.parse(readFileSync(path.join(root, project, "package.json"), "utf8"))
    expect(pkg.engines.node).toBe(">=18.18")
    expect(pkg.devDependencies.tsx).toBe("^4")
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
