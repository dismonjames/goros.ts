import { expect, test } from "bun:test"
import { createFileWatcher } from "../packages/boronix/src/dev/watcher"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import os from "node:os"

function waitForCondition(cond: () => boolean, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (cond()) {
        resolve()
      } else if (Date.now() - start > timeoutMs) {
        reject(new Error("Condition timeout"))
      } else {
        setTimeout(check, 50)
      }
    }
    check()
  })
}

test("watcher detects file modify", async () => {
  const root = path.join(os.tmpdir(), `boronix-watch-mod-${Date.now()}`)
  mkdirSync(path.join(root, "app", "routes", "home"), { recursive: true })
  const filePath = path.join(root, "app", "routes", "home", "page.html")
  writeFileSync(filePath, "<h1>Original</h1>")

  let changes: any[] = []
  const watcher = createFileWatcher({
    root,
    watchPaths: [path.join(root, "app")],
    debounceMs: 30,
    onChange: (c) => { changes = c }
  })

  writeFileSync(filePath, "<h1>Updated</h1>")

  await waitForCondition(() => changes.length > 0)

  expect(changes.length).toBeGreaterThan(0)
  expect(changes[0].relativePath).toContain("page.html")

  watcher.close()
  rmSync(root, { recursive: true, force: true })
})

test("watcher detects file create", async () => {
  const root = path.join(os.tmpdir(), `boronix-watch-create-${Date.now()}`)
  mkdirSync(path.join(root, "app", "routes"), { recursive: true })

  let changes: any[] = []
  const watcher = createFileWatcher({
    root,
    watchPaths: [path.join(root, "app")],
    debounceMs: 30,
    onChange: (c) => { changes = c }
  })

  mkdirSync(path.join(root, "app", "routes", "about"), { recursive: true })
  writeFileSync(path.join(root, "app", "routes", "about", "page.html"), "<h1>About</h1>")

  await waitForCondition(() => changes.length > 0)

  expect(changes.some(c => c.relativePath.includes("about"))).toBe(true)

  watcher.close()
  rmSync(root, { recursive: true, force: true })
})

test("watcher debounces duplicate events", async () => {
  const root = path.join(os.tmpdir(), `boronix-watch-debounce-${Date.now()}`)
  mkdirSync(path.join(root, "app", "routes", "home"), { recursive: true })
  const filePath = path.join(root, "app", "routes", "home", "page.html")
  writeFileSync(filePath, "<h1>Original</h1>")

  let changeCount = 0
  const watcher = createFileWatcher({
    root,
    watchPaths: [path.join(root, "app")],
    debounceMs: 50,
    onChange: () => { changeCount++ }
  })

  writeFileSync(filePath, "<h1>1</h1>")
  writeFileSync(filePath, "<h1>2</h1>")
  writeFileSync(filePath, "<h1>3</h1>")

  await waitForCondition(() => changeCount > 0)
  await new Promise(r => setTimeout(r, 200))

  expect(changeCount).toBe(1)

  watcher.close()
  rmSync(root, { recursive: true, force: true })
})

test("watcher close stops watching", async () => {
  const root = path.join(os.tmpdir(), `boronix-watch-close-${Date.now()}`)
  mkdirSync(path.join(root, "app", "routes", "home"), { recursive: true })
  const filePath = path.join(root, "app", "routes", "home", "page.html")
  writeFileSync(filePath, "<h1>Original</h1>")

  let changeCount = 0
  const watcher = createFileWatcher({
    root,
    watchPaths: [path.join(root, "app")],
    debounceMs: 30,
    onChange: () => { changeCount++ }
  })

  watcher.close()

  writeFileSync(filePath, "<h1>After close</h1>")
  await new Promise(r => setTimeout(r, 200))

  expect(changeCount).toBe(0)

  rmSync(root, { recursive: true, force: true })
})

test("watcher ignores .boronix directory", async () => {
  const root = path.join(os.tmpdir(), `boronix-watch-ignore-${Date.now()}`)
  mkdirSync(path.join(root, "app", "routes", "home"), { recursive: true })
  mkdirSync(path.join(root, ".boronix"), { recursive: true })
  writeFileSync(path.join(root, "app", "routes", "home", "page.html"), "<h1>Home</h1>")

  let changes: any[] = []
  const watcher = createFileWatcher({
    root,
    watchPaths: [path.join(root, "app"), path.join(root, ".boronix")],
    debounceMs: 30,
    onChange: (c) => { changes = changes.concat(c) }
  })

  writeFileSync(path.join(root, ".boronix", "manifest.json"), "{}")

  await new Promise(r => setTimeout(r, 300))

  expect(changes.filter(c => c.relativePath.includes(".boronix")).length).toBe(0)

  watcher.close()
  rmSync(root, { recursive: true, force: true })
})
