import { spawn, type ChildProcess } from "node:child_process"
import { fileURLToPath } from "node:url"
import { decodeDevMessage, type ChildToSupervisorMessage, type SupervisorToChildMessage } from "./protocol"

export type DevChildOptions = {
  root: string
  runtime: "bun" | "node" | "deno"
  port?: number | undefined
  host?: string | undefined
  revision: number
  quiet?: boolean | undefined
  verbose?: boolean | undefined
  plain?: boolean | undefined
  noColor?: boolean | undefined
  reloadEnabled: boolean
  onMessage(message: ChildToSupervisorMessage): void
  onOutput(line: string, isError: boolean): void
  onExit(code: number | null, signal: NodeJS.Signals | null): void
}

export type DevChild = {
  pid: number | undefined
  send(message: SupervisorToChildMessage): void
  stop(reason: string, timeoutMs?: number): Promise<void>
}

function workerEntry(): string {
  const source = fileURLToPath(new URL("./worker.ts", import.meta.url))
  const built = fileURLToPath(new URL("../../dist/dev/worker.js", import.meta.url))
  return import.meta.url.endsWith(".ts") ? source : built
}

export function spawnDevChild(options: DevChildOptions): DevChild {
  // Bun remains the worker executable for both HTTP adapters because Node 20
  // cannot import application .ts modules without a loader. `runtime` still
  // selects the HTTP listener inside worker.ts.
  const command = process.execPath
  const args = [workerEntry(), "--root", options.root, "--runtime", options.runtime, "--revision", String(options.revision)]
  if (options.port !== undefined) args.push("--port", String(options.port))
  if (options.host !== undefined) args.push("--host", options.host)
  if (options.quiet) args.push("--quiet")
  if (options.verbose) args.push("--verbose")
  if (options.plain) args.push("--plain")
  if (options.noColor) args.push("--no-color")
  if (!options.reloadEnabled) args.push("--no-reload")

  const child = spawn(command, args, { cwd: options.root, stdio: ["pipe", "pipe", "pipe"] })
  let stopping = false
  let exited = false
  let stdoutBuffer = ""
  let stderrBuffer = ""

  function consume(chunk: Buffer | string, isError: boolean): void {
    let buffer = (isError ? stderrBuffer : stdoutBuffer) + chunk.toString()
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ""
    if (isError) stderrBuffer = buffer
    else stdoutBuffer = buffer
    for (const line of lines) {
      const message = !isError ? decodeDevMessage(line) : undefined
      if (message) options.onMessage(message)
      else if (line) options.onOutput(line, isError)
    }
  }

  child.stdout?.on("data", (chunk) => consume(chunk, false))
  child.stderr?.on("data", (chunk) => consume(chunk, true))
  child.on("exit", (code, signal) => {
    exited = true
    options.onExit(code, signal)
  })

  return {
    get pid() { return child.pid },
    send(message) {
      if (!exited && child.stdin?.writable) child.stdin.write(`${JSON.stringify(message)}\n`)
    },
    async stop(reason, timeoutMs = 3000) {
      if (exited || stopping) return
      stopping = true
      this.send({ type: "shutdown", reason })
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (!exited) child.kill("SIGTERM")
          setTimeout(() => {
            if (!exited) child.kill("SIGKILL")
            resolve()
          }, 1000)
        }, timeoutMs)
        child.once("exit", () => {
          clearTimeout(timer)
          resolve()
        })
      })
    }
  }
}
