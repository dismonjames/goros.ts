import http, { type IncomingMessage, type ServerResponse } from "node:http"
import { Readable } from "node:stream"
import type { RuntimeServer } from "./types"

export const nodeRuntime: RuntimeServer = {
  serve(options) {
    return http.createServer(async (nodeReq, nodeRes) => {
      try {
        const req = nodeRequestToWebRequest(nodeReq, options.host)
        const response = await options.fetch(req)
        await writeWebResponse(response, nodeRes)
      } catch (error) {
        nodeRes.statusCode = 500
        nodeRes.end(error instanceof Error ? error.message : "Internal Server Error")
      }
    }).listen(options.port, options.host)
  }
}

export function nodeRequestToWebRequest(req: IncomingMessage, host: string): Request {
  const protocol = "http"
  const requestHost = req.headers.host ?? host
  const url = `${protocol}://${requestHost}${req.url ?? "/"}`
  const headers = new Headers()

  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item)
    } else if (value != null) {
      headers.set(name, value)
    }
  }

  const method = req.method ?? "GET"
  const hasBody = !["GET", "HEAD"].includes(method)

  return new Request(url, {
    method,
    headers,
    body: hasBody ? Readable.toWeb(req) as unknown as ReadableStream : undefined,
    duplex: hasBody ? "half" : undefined
  } as RequestInit & { duplex?: "half" })
}

export async function writeWebResponse(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status
  res.statusMessage = response.statusText

  response.headers.forEach((value, name) => {
    res.setHeader(name, value)
  })

  if (!response.body) {
    res.end()
    return
  }

  const body = Buffer.from(await response.arrayBuffer())
  res.end(body)
}
