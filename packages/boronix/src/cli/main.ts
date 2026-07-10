#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseCliArgs, type CliArgs } from "./args"
import { buildCommand } from "./commands/build"
import { devCommand } from "./commands/dev"
import { startCommand } from "./commands/start"
import { infoCommand } from "./commands/info"
import { doctorCommand } from "./commands/doctor"
import { typegenCommand } from "./commands/typegen"
import { routesCommand } from "./commands/routes"
import { inspectCommand } from "./commands/inspect"
import { dbCommand } from "./commands/db"
import { initUiSettings } from "./ui/terminal"
import { formatRootHelp, formatCommandHelp } from "./ui/format"
import { formatCliError } from "./ui/errors"

function getVersion(): string {
  try {
    const cliDir = path.dirname(fileURLToPath(import.meta.url))
    let dir = cliDir
    while (dir && dir !== path.dirname(dir)) {
      const pkgPath = path.join(dir, "package.json")
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
        if (pkg.name === "boronix") {
          return pkg.version
        }
      }
      dir = path.dirname(dir)
    }
  } catch {}
  return "0.2.2"
}

async function main(argv: string[]): Promise<void> {
  let parsed: CliArgs
  try {
    parsed = parseCliArgs(argv)
  } catch (err: any) {
    initUiSettings()
    console.error(formatCliError(err))
    process.exit(1)
  }

  initUiSettings({ plain: parsed.plain, noColor: parsed.noColor })

  if (parsed.version) {
    console.log(getVersion())
    return
  }

  if (parsed.help) {
    if (parsed.command) {
      console.log(formatCommandHelp(parsed.command))
    } else {
      console.log(formatRootHelp())
    }
    return
  }

  if (!parsed.command) {
    console.log(formatRootHelp())
    process.exit(1)
  }

  if (parsed.command === "dev") {
    await devCommand(parsed.root, {
      runtime: parsed.runtime,
      port: parsed.port,
      host: parsed.host,
      plain: parsed.plain,
      noColor: parsed.noColor,
      open: parsed.open,
      quiet: parsed.quiet,
      verbose: parsed.verbose,
      noReload: parsed.noReload,
      debugWatch: parsed.debugWatch
    })
    return
  }

  if (parsed.command === "build") {
    await buildCommand(parsed.root, {
      runtime: parsed.runtime,
      plain: parsed.plain,
      noColor: parsed.noColor
    })
    return
  }

  if (parsed.command === "start") {
    await startCommand(parsed.root, {
      runtime: parsed.runtime,
      port: parsed.port,
      host: parsed.host,
      plain: parsed.plain,
      noColor: parsed.noColor,
      quiet: parsed.quiet,
      verbose: parsed.verbose
    })
    return
  }

  if (parsed.command === "info") {
    await infoCommand(parsed.root, {
      plain: parsed.plain,
      noColor: parsed.noColor
    })
    return
  }

  if (parsed.command === "doctor") {
    await doctorCommand(parsed.root, {
      plain: parsed.plain,
      noColor: parsed.noColor,
      production: parsed.production,
      json: parsed.json
    })
    return
  }

  if (parsed.command === "typegen") {
    await typegenCommand(parsed.root, {
      plain: parsed.plain,
      noColor: parsed.noColor
    })
    return
  }

  if (parsed.command === "routes") {
    await routesCommand(parsed.root, {
      plain: parsed.plain,
      noColor: parsed.noColor,
      json: parsed.json,
      full: parsed.full,
      flat: parsed.flat
    })
    return
  }

  if (parsed.command === "inspect") {
    const routePath = parsed.positionals[0] ?? ""
    await inspectCommand(parsed.root, routePath, {
      plain: parsed.plain,
      noColor: parsed.noColor,
      json: parsed.json,
      method: parsed.method
    })
    return
  }

  if (parsed.command === "db") {
    await dbCommand(parsed.root, parsed.positionals[0], {
      plain: parsed.plain,
      noColor: parsed.noColor
    })
    return
  }

  // Unknown command
  const error = new Error(`Unknown command: ${parsed.command}`)
  console.error(formatCliError(error))
  console.log("\n" + formatRootHelp())
  process.exit(1)
}

main(process.argv).catch((error: unknown) => {
  console.error(formatCliError(error))
  process.exit(1)
})
