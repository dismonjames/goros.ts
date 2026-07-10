import path from "node:path"
import { BoronixUserError } from "../core/errors"

export type CliArgs = {
  command?: string | undefined
  root: string
  runtime?: "bun" | "node" | "deno" | undefined
  port?: number | undefined
  host?: string | undefined
  plain: boolean
  noColor: boolean
  help: boolean
  version: boolean
  open: boolean
  quiet: boolean
  verbose: boolean
  json: boolean
  full: boolean
  flat: boolean
  production: boolean
  noReload: boolean
  debugWatch: boolean
  method?: string | undefined
  positionals: string[]
}

export function parseCliArgs(argv: string[]): CliArgs {
  const args = argv.slice(2)
  let command: string | undefined = undefined
  let root = "."
  let runtime: "bun" | "node" | "deno" | undefined = undefined
  let port: number | undefined = undefined
  let host: string | undefined = undefined
  const positionals: string[] = []
  let plain = false
  let noColor = false
  let help = false
  let version = false
  let open = false
  let quiet = false
  let verbose = false
  let json = false
  let full = false
  let flat = false
  let production = false
  let noReload = false
  let debugWatch = false
  let method: string | undefined = undefined

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === undefined) continue
    if (arg === "-h" || arg === "--help") {
      help = true
    } else if (arg === "-v" || arg === "--version") {
      version = true
    } else if (arg === "--plain") {
      plain = true
    } else if (arg === "--no-color") {
      noColor = true
    } else if (arg === "-o" || arg === "--open") {
      open = true
    } else if (arg === "--quiet") {
      quiet = true
    } else if (arg === "--verbose") {
      verbose = true
    } else if (arg === "--json") {
      json = true
    } else if (arg === "--full") {
      full = true
    } else if (arg === "--flat") {
      flat = true
    } else if (arg === "--production") {
      production = true
    } else if (arg === "--no-reload") {
      noReload = true
    } else if (arg === "--debug-watch") {
      debugWatch = true
    } else if (arg === "--method") {
      const val = args[i + 1]
      if (val && !val.startsWith("-")) {
        method = val
        i++
      }
    } else if (arg === "--root") {
      const val = args[i + 1]
      if (val && !val.startsWith("-")) {
        root = val
        i++
      }
    } else if (arg === "--runtime") {
      const val = args[i + 1]
      if (val === "bun" || val === "node" || val === "deno") {
        runtime = val
        i++
      } else if (val) {
        throw new BoronixUserError(`Invalid runtime: ${val}`, {
          code: "KQ_RUNTIME_UNSUPPORTED",
          hint: "Supported runtimes are: bun | node"
        })
      }
    } else if (arg === "-p" || arg === "--port") {
      const val = args[i + 1]
      if (val && !val.startsWith("-")) {
        port = parseInt(val, 10)
        if (isNaN(port)) {
          throw new Error(`Invalid port: ${val}`)
        }
        i++
      }
    } else if (arg === "-H" || arg === "--host") {
      const val = args[i + 1]
      if (val && !val.startsWith("-")) {
        host = val
        i++
      }
    } else if (!arg.startsWith("-")) {
      if (!command) {
        command = arg
      } else {
        positionals.push(arg)
      }
    }
  }

  return {
    command,
    root: path.resolve(root),
    runtime,
    port,
    host,
    plain,
    noColor,
    help,
    version,
    open,
    quiet,
    verbose,
    json,
    full,
    flat,
    production,
    noReload,
    debugWatch,
    method,
    positionals
  }
}
