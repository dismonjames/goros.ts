import { expect, test } from "bun:test"
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import path from "node:path"
import os from "node:os"

const repo = path.resolve(".")
const bun = path.join(os.homedir(), ".bun", "bin", "bun")

function fixture(): string {
  const root = path.join(os.tmpdir(), `boronix-supervisor-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(path.join(root, "app", "routes"), { recursive: true })
  mkdirSync(path.join(root, "public"), { recursive: true })
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module", devDependencies: { tsx: "^4" } }))
  mkdirSync(path.join(root, "node_modules"), { recursive: true })
  symlinkSync(path.join(repo, "node_modules", "tsx"), path.join(root, "node_modules", "tsx"), "dir")
  writeFileSync(path.join(root, "app", "routes", "page.html"), "<main>{{ message }} {{ pid }} {{ runtime }} {{ bun }}</main>")
  writeFileSync(path.join(root, "app", "routes", "page.ts"), 'export default () => ({ message: "version-one", pid: process.pid, runtime: process.release?.name ?? "unknown", bun: String(typeof Bun !== "undefined") })\n')
  writeFileSync(path.join(root, "public", "style.css"), "body { color: red; }\n")
  return root
}

async function response(port: number, pathname = "/"): Promise<{ status: number; body: string }> {
  const result = await fetch(`http://127.0.0.1:${port}${pathname}`)
  return { status: result.status, body: await result.text() }
}

async function waitFor(port: number, predicate: (result: { status: number; body: string }) => boolean): Promise<{ status: number; body: string }> {
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    try {
      const result = await response(port)
      if (predicate(result)) return result
    } catch {}
    await Bun.sleep(40)
  }
  throw new Error("dev supervisor did not reach expected state")
}

for (const runtime of ["bun", "node"] as const) {
  test(`dev supervisor reloads server modules and preserves child for templates (${runtime})`, async () => {
    const root = fixture()
    const port = 4600 + Math.floor(Math.random() * 300)
    const proc = Bun.spawn({
      cmd: [bun, "run", "packages/boronix/src/cli/main.ts", "dev", "--root", root, "--runtime", runtime, "--port", String(port), "--host", "127.0.0.1", "--plain"],
      cwd: repo,
      stdout: "ignore",
      stderr: "ignore"
    })
    try {
      const first = await waitFor(port, value => value.status === 200 && value.body.includes("version-one"))
      const firstPid = first.body.match(/version-one\s+(\d+)/)?.[1]
      expect(firstPid).toBeDefined()
      if (runtime === "node") {
        expect(first.body).toContain("node false")
      }

      writeFileSync(path.join(root, "app", "routes", "page.ts"), 'export default () => ({ message: "version-two", pid: process.pid, runtime: process.release?.name ?? "unknown", bun: String(typeof Bun !== "undefined") })\n')
      const second = await waitFor(port, value => value.status === 200 && value.body.includes("version-two"))
      const secondPid = second.body.match(/version-two\s+(\d+)/)?.[1]
      expect(secondPid).toBeDefined()
      expect(secondPid).not.toBe(firstPid)

      writeFileSync(path.join(root, "app", "routes", "page.html"), "<main>template-two {{ message }} {{ pid }}</main>")
      const template = await waitFor(port, value => value.status === 200 && value.body.includes("template-two"))
      expect(template.body.match(/version-two\s+(\d+)/)?.[1]).toBe(secondPid)

      rmSync(path.join(root, "app", "routes", "page.html"))
      const rootGoneDeadline = Date.now() + 8000
      let rootGone = false
      while (Date.now() < rootGoneDeadline) {
        try { if ((await response(port)).status === 404) { rootGone = true; break } } catch {}
        await Bun.sleep(40)
      }
      expect(rootGone).toBe(true)
      writeFileSync(path.join(root, "app", "routes", "page.html"), "<main>template-restored {{ message }} {{ pid }}</main>")
      await waitFor(port, value => value.status === 200 && value.body.includes("template-restored"))

      const about = path.join(root, "app", "routes", "about")
      mkdirSync(about, { recursive: true })
      writeFileSync(path.join(about, "page.html"), "<main>about</main>")
      const addDeadline = Date.now() + 8000
      let added = false
      while (Date.now() < addDeadline) {
        try { if ((await response(port, "/about")).status === 200) { added = true; break } } catch {}
        await Bun.sleep(40)
      }
      expect(added).toBe(true)
      rmSync(about, { recursive: true, force: true })
      const removeDeadline = Date.now() + 8000
      let removed = false
      while (Date.now() < removeDeadline) {
        try { if ((await response(port, "/about")).status === 404) { removed = true; break } } catch {}
        await Bun.sleep(40)
      }
      expect(removed).toBe(true)
    } finally {
      try { proc.kill("SIGTERM") } catch {}
      await Promise.race([proc.exited, Bun.sleep(5000)])
      expect(proc.exitCode).not.toBeNull()
      rmSync(root, { recursive: true, force: true })
    }
  }, 30000)
}
