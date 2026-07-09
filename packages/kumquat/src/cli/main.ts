#!/usr/bin/env bun
import path from "node:path"
import { buildCommand } from "./commands/build"
import { devCommand } from "./commands/dev"
import { startCommand } from "./commands/start"
import type { ResolvedKumquatConfig } from "../config/types"

type CliOptions = {
  command: string
  root: string
  runtime?: ResolvedKumquatConfig["runtime"]
}

async function main(argv: string[]): Promise<void> {
  const options = parseArgs(argv)

  if (options.command === "dev") {
    await devCommand(options.root, options.runtime)
    return
  }

  if (options.command === "build") {
    await buildCommand(options.root)
    return
  }

  if (options.command === "start") {
    await startCommand(options.root, options.runtime)
    return
  }

  console.error("Usage: kumquat <dev|build|start> [--root <dir>] [--runtime <bun|node|deno>]")
  process.exit(1)
}

function parseArgs(argv: string[]): CliOptions {
  const command = argv[2] ?? "dev"
  const rootFlagIndex = argv.indexOf("--root")
  const root = rootFlagIndex >= 0 ? argv[rootFlagIndex + 1] : "."
  const runtimeFlagIndex = argv.indexOf("--runtime")
  const runtime = runtimeFlagIndex >= 0 ? parseRuntime(argv[runtimeFlagIndex + 1]) : undefined

  return {
    command,
    root: path.resolve(root ?? "."),
    ...(runtime ? { runtime } : {})
  }
}

function parseRuntime(value: string | undefined): ResolvedKumquatConfig["runtime"] | undefined {
  if (value === "bun" || value === "node" || value === "deno") return value
  if (value) {
    throw new Error(`Invalid runtime: ${value}`)
  }
  return undefined
}

main(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
