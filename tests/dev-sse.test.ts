import { expect, test } from "bun:test"
import { createReloadChannel } from "../packages/boronix/src/dev/reload-channel"
import os from "node:os"

test("SSE endpoint returns correct content type", () => {
  const channel = createReloadChannel()
  const res = channel.handleSSE(new Request("http://localhost/__boronix/dev-events"))

  expect(res.status).toBe(200)
  expect(res.headers.get("content-type")).toBe("text/event-stream")
  expect(res.headers.get("cache-control")).toBe("no-cache, no-store")
  expect(res.headers.get("connection")).toBe("keep-alive")

  channel.close()
})

test("reload event is broadcast to connected clients", async () => {
  const channel = createReloadChannel()
  const res = channel.handleSSE(new Request("http://localhost/__boronix/dev-events"))

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  const first = await reader.read()
  expect(first.value).toBeDefined()

  channel.broadcast({
    type: "reload",
    reason: "template",
    path: "app/routes/home/page.html",
    revision: 2
  })

  const second = await reader.read()
  const text = decoder.decode(second.value)
  expect(text).toContain("event: reload")
  expect(text).toContain('"type":"reload"')
  expect(text).toContain('"reason":"template"')
  expect(text).toContain('"revision":2')

  channel.close()
})

test("connected event can be broadcast", async () => {
  const channel = createReloadChannel()
  const res = channel.handleSSE(new Request("http://localhost/__boronix/dev-events"))

  const reader = res.body!.getReader()
  await reader.read()

  channel.broadcast({ type: "connected", revision: 1 })

  const chunk = await reader.read()
  const text = new TextDecoder().decode(chunk.value)
  expect(text).toContain("event: connected")

  channel.close()
})

test("error event can be broadcast", async () => {
  const channel = createReloadChannel()
  const res = channel.handleSSE(new Request("http://localhost/__boronix/dev-events"))

  const reader = res.body!.getReader()
  await reader.read()

  channel.broadcast({ type: "error", message: "SyntaxError", revision: 3 })

  const chunk = await reader.read()
  const text = new TextDecoder().decode(chunk.value)
  expect(text).toContain("event: error")
  expect(text).toContain('"message":"SyntaxError"')

  channel.close()
})

test("clientCount tracks connections", () => {
  const channel = createReloadChannel()
  expect(channel.clientCount()).toBe(0)

  channel.handleSSE(new Request("http://localhost/__boronix/dev-events"))
  expect(channel.clientCount()).toBe(1)

  channel.close()
})

test("broadcast does not send absolute paths in SSE payload", async () => {
  const channel = createReloadChannel()
  const res = channel.handleSSE(new Request("http://localhost/__boronix/dev-events"))

  const reader = res.body!.getReader()
  await reader.read()

  channel.broadcast({
    type: "reload",
    reason: "template",
    path: "app/routes/home/page.html",
    revision: 2
  })

  const chunk = await reader.read()
  const text = new TextDecoder().decode(chunk.value)
  expect(text).not.toContain("/Users/")
  expect(text).not.toContain("C:\\")
  expect(text).not.toContain("/tmp/")
  expect(text).not.toContain(os.tmpdir())

  channel.close()
})

test("close cleans up connections without throwing", () => {
  const channel = createReloadChannel()
  channel.handleSSE(new Request("http://localhost/__boronix/dev-events"))
  expect(() => channel.close()).not.toThrow()
})
