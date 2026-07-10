import { expect, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import os from "node:os"
import { servePublic } from "../packages/boronix/src/static/serve-public"
import { setBoronixMode } from "../packages/boronix/src/core/mode"

test("public asset change is reflected immediately", async () => {
  const dir = path.join(os.tmpdir(), `boronix-public-${Date.now()}`)
  mkdirSync(dir, { recursive: true })
  setBoronixMode("development")

  writeFileSync(path.join(dir, "style.css"), "body { color: red; }")

  const url1 = new URL("http://localhost/style.css")
  const res1 = await servePublic(dir, url1)
  expect(res1!.status).toBe(200)
  const text1 = await res1!.text()
  expect(text1).toContain("color: red")

  writeFileSync(path.join(dir, "style.css"), "body { color: blue; }")

  const url2 = new URL("http://localhost/style.css")
  const res2 = await servePublic(dir, url2)
  expect(res2!.status).toBe(200)
  const text2 = await res2!.text()
  expect(text2).toContain("color: blue")

  rmSync(dir, { recursive: true, force: true })
})

test("public asset delete returns 404 immediately", async () => {
  const dir = path.join(os.tmpdir(), `boronix-public-del-${Date.now()}`)
  mkdirSync(dir, { recursive: true })
  setBoronixMode("development")

  writeFileSync(path.join(dir, "script.js"), "console.log(1)")

  const url1 = new URL("http://localhost/script.js")
  const res1 = await servePublic(dir, url1)
  expect(res1).not.toBeNull()
  expect(res1!.status).toBe(200)

  rmSync(path.join(dir, "script.js"))

  const url2 = new URL("http://localhost/script.js")
  const res2 = await servePublic(dir, url2)
  expect(res2).toBeNull()

  rmSync(dir, { recursive: true, force: true })
})

test("public asset ETag changes when content changes", async () => {
  const dir = path.join(os.tmpdir(), `boronix-etag-${Date.now()}`)
  mkdirSync(dir, { recursive: true })
  setBoronixMode("development")

  writeFileSync(path.join(dir, "app.css"), ".a { color: red; }")

  const res1 = await servePublic(dir, new URL("http://localhost/app.css"))
  const etag1 = res1!.headers.get("etag")

  writeFileSync(path.join(dir, "app.css"), ".a { color: blue; }")

  const res2 = await servePublic(dir, new URL("http://localhost/app.css"))
  const etag2 = res2!.headers.get("etag")

  expect(etag1).not.toBe(etag2)

  rmSync(dir, { recursive: true, force: true })
})
