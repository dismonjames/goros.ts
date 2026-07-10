import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import os from "node:os"

const countIndex = process.argv.indexOf("--count")
const count = countIndex >= 0 ? Number(process.argv[countIndex + 1]) : 100
if (!Number.isInteger(count) || count < 1) throw new Error("--count must be a positive integer")

const root = path.join(os.tmpdir(), `boronix-stress-${Date.now()}`)
const port = 4900 + Math.floor(Math.random() * 200)
const bun = path.join(os.homedir(), ".bun", "bin", "bun")
const modulePath = path.join(root, "app", "routes", "home", "page.ts")
mkdirSync(path.dirname(modulePath), { recursive: true })
writeFileSync(path.join(root, "app", "routes", "home", "page.html"), "<main>{{ message }} {{ pid }}</main>")
writeFileSync(modulePath, 'export default () => ({ message: "generation-0", pid: process.pid })\n')

async function fetchPage(): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${port}/`)
  return await response.text()
}

async function waitFor(marker: string): Promise<string> {
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    try {
      const html = await fetchPage()
      if (html.includes(marker)) return html
    } catch {}
    await Bun.sleep(25)
  }
  throw new Error(`timeout waiting for ${marker}`)
}

const supervisor = Bun.spawn({
  cmd: [bun, "run", "packages/boronix/src/cli/main.ts", "dev", "--root", root, "--runtime", "bun", "--port", String(port), "--host", "127.0.0.1", "--plain", "--quiet"],
  cwd: path.resolve("."),
  stdout: "ignore",
  stderr: "ignore"
})

const durations: number[] = []
const pids = new Set<string>()
let failures = 0
try {
  await waitFor("generation-0")
  for (let index = 1; index <= count; index++) {
    const marker = `generation-${index}`
    const started = performance.now()
    writeFileSync(modulePath, `export default () => ({ message: "${marker}", pid: process.pid })\n`)
    try {
      const html = await waitFor(marker)
      const pid = html.match(new RegExp(`${marker}\\s+(\\d+)`))?.[1]
      if (pid) pids.add(pid)
      durations.push(performance.now() - started)
    } catch (error) {
      failures++
      console.error(`✖ generation ${index}: ${error instanceof Error ? error.message : error}`)
      break
    }
  }
  const average = durations.reduce((sum, value) => sum + value, 0) / Math.max(durations.length, 1)
  const max = Math.max(...durations, 0)
  console.log(`stress dev reload: ${durations.length}/${count} passed; failures=${failures}; unique child PIDs=${pids.size}; avg=${Math.round(average)}ms; max=${Math.round(max)}ms`)
  console.log(`supervisor RSS observation: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MiB (no fixed threshold; inspect for linear growth across repeated runs)`)
  if (failures) process.exitCode = 1
} finally {
  try { supervisor.kill("SIGTERM") } catch {}
  await Promise.race([supervisor.exited, Bun.sleep(5000)])
  rmSync(root, { recursive: true, force: true })
}
