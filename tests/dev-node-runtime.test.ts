import { expect, test } from "bun:test"
import { nodeRequestToWebRequest, writeWebResponse } from "../packages/boronix/src/runtime/node"
import { injectDevClient, shouldInjectDevClient } from "../packages/boronix/src/dev/dev-client"
import { createReloadChannel } from "../packages/boronix/src/dev/reload-channel"
import http from "node:http"

test("node runtime supports SSE response headers", async () => {
  const channel = createReloadChannel()

  const server = http.createServer(async (nodeReq, nodeRes) => {
    const req = nodeRequestToWebRequest(nodeReq, "127.0.0.1")
    const url = new URL(req.url)

    if (url.pathname === "/__boronix/dev-events") {
      nodeRes.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-store",
        "connection": "keep-alive"
      })
      nodeRes.write(": connected\n\n")
      nodeRes.end()
      return
    }

    nodeRes.statusCode = 404
    nodeRes.end("not found")
  })

  const port = await new Promise<number>(resolve => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address()
      if (typeof addr === "object" && addr) resolve(addr.port)
    })
  })

  const res = await fetch(`http://127.0.0.1:${port}/__boronix/dev-events`)
  expect(res.status).toBe(200)
  expect(res.headers.get("content-type")).toBe("text/event-stream")

  channel.close()
  server.close()
})

test("node runtime dev client injection works on HTML responses", () => {
  const html = "<html><body><h1>Hello</h1></body></html>"
  const injected = injectDevClient(html)
  expect(injected).toContain("data-boronix-dev-client")

  const res = new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" }
  })
  expect(shouldInjectDevClient(res)).toBe(true)
})

test("node runtime reload channel broadcast works", async () => {
  const channel = createReloadChannel()
  const sseRes = channel.handleSSE(new Request("http://localhost/__boronix/dev-events"))

  const reader = sseRes.body!.getReader()
  await reader.read()

  channel.broadcast({ type: "reload", reason: "template", revision: 5 })

  const chunk = await reader.read()
  const text = new TextDecoder().decode(chunk.value)
  expect(text).toContain("reload")
  expect(text).toContain('"revision":5')

  channel.close()
})
