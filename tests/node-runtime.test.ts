import http from "node:http"
import { expect, test } from "bun:test"
import { nodeRequestToWebRequest, writeWebResponse } from "../packages/kumquat/src/runtime/node"

test("node runtime bridge handles basic GET responses", async () => {
  const server = createBridgeServer(async () => new Response("hello", {
    status: 201,
    headers: {
      "x-kumquat": "node"
    }
  }))

  const url = await listen(server)
  const response = await fetch(url)

  expect(response.status).toBe(201)
  expect(response.headers.get("x-kumquat")).toBe("node")
  expect(await response.text()).toBe("hello")

  server.close()
})

test("node runtime bridge handles JSON responses", async () => {
  const server = createBridgeServer(async () => Response.json({ ok: true }))
  const url = await listen(server)
  const response = await fetch(url)

  expect(await response.json()).toEqual({ ok: true })

  server.close()
})

function createBridgeServer(fetchHandler: (req: Request) => Promise<Response> | Response) {
  return http.createServer(async (nodeReq, nodeRes) => {
    const req = nodeRequestToWebRequest(nodeReq, "127.0.0.1")
    await writeWebResponse(await fetchHandler(req), nodeRes)
  })
}

function listen(server: http.Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (typeof address === "object" && address) {
        resolve(`http://127.0.0.1:${address.port}/`)
      }
    })
  })
}
