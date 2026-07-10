import type { DevReloadEvent } from "./types"

export type ReloadChannel = {
  handleSSE(req: Request): Response
  broadcast(event: DevReloadEvent): void
  close(): void
  clientCount(): number
}

export function createReloadChannel(revision = 1, heartbeatIntervalMs = 20000): ReloadChannel {
  const clients = new Set<{
    controller: ReadableStreamDefaultController
    heartbeatTimer: ReturnType<typeof setInterval>
  }>()

  let closed = false

  function encodeEvent(event: DevReloadEvent): string {
    const data = JSON.stringify(event)
    return `event: ${event.type}\ndata: ${data}\n\n`
  }

  function sendHeartbeat(controller: ReadableStreamDefaultController): void {
    try {
      controller.enqueue(": ping\n\n")
    } catch {
      // client disconnected
    }
  }

  return {
    handleSSE(): Response {
      const stream = new ReadableStream({
        start(controller) {
          const heartbeatTimer = setInterval(() => {
            sendHeartbeat(controller)
          }, heartbeatIntervalMs)

          const client = { controller, heartbeatTimer }
          clients.add(client)

          try {
            controller.enqueue(new TextEncoder().encode(encodeEvent({ type: "connected", revision })))
          } catch {}
        },
        cancel() {
          // handled below via cleanup
        }
      })

      return new Response(stream, {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache, no-store",
          "connection": "keep-alive"
        }
      })
    },

    broadcast(event: DevReloadEvent): void {
      if (closed) return
      const encoded = encodeEvent(event)
      for (const client of clients) {
        try {
          client.controller.enqueue(new TextEncoder().encode(encoded))
        } catch {
          try {
            clearInterval(client.heartbeatTimer)
          } catch {}
          clients.delete(client)
        }
      }
    },

    close(): void {
      closed = true
      for (const client of clients) {
        try {
          clearInterval(client.heartbeatTimer)
        } catch {}
        try {
          client.controller.close()
        } catch {}
      }
      clients.clear()
    },

    clientCount(): number {
      return clients.size
    }
  }
}
