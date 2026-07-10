import { existsSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { resolvePath } from "../utils/path"
import { defaultConfig, type BoronixConfig, type ResolvedBoronixConfig } from "./types"

import { getBoronixMode } from "../core/mode"

export async function loadConfig(root: string): Promise<ResolvedBoronixConfig> {
  let configPath = resolvePath(root, "boronix.config.ts")
  let userConfig: BoronixConfig = {}

  if (!existsSync(configPath)) {
    const legacyPath = resolvePath(root, "kumquat.config.ts")
    if (existsSync(legacyPath)) {
      console.warn("\x1b[33m⚠\x1b[0m kumquat.config.ts is deprecated. Rename it to boronix.config.ts.")
      configPath = legacyPath
    }
  }

  if (existsSync(configPath)) {
    // Development config changes restart the isolated dev worker. A normal import
    // is therefore sufficient and deliberately avoids process-local cache tricks.
    const module = await import(pathToFileURL(configPath).href)
    userConfig = module.default ?? {}
  }

  return {
    runtime: userConfig.runtime ?? defaultConfig.runtime,
    server: {
      port: userConfig.server?.port ?? defaultConfig.server.port,
      host: userConfig.server?.host ?? defaultConfig.server.host
    },
    session: {
      name: userConfig.session?.name ?? defaultConfig.session.name,
      secret: resolveSessionSecret(userConfig.session?.secret),
      maxAge: userConfig.session?.maxAge ?? defaultConfig.session.maxAge,
      sameSite: userConfig.session?.sameSite ?? defaultConfig.session.sameSite,
      secure: userConfig.session?.secure ?? defaultConfig.session.secure
    },
    app: {
      root: userConfig.app?.root ?? defaultConfig.app.root,
      routesDir: userConfig.app?.routesDir ?? defaultConfig.app.routesDir,
      publicDir: userConfig.app?.publicDir ?? defaultConfig.app.publicDir
    },
    cli: {
      color: userConfig.cli?.color ?? defaultConfig.cli.color,
      unicode: userConfig.cli?.unicode ?? defaultConfig.cli.unicode,
      requestLog: userConfig.cli?.requestLog ?? defaultConfig.cli.requestLog,
      groupRoutes: userConfig.cli?.groupRoutes ?? defaultConfig.cli.groupRoutes
    },
    health: {
      enabled: userConfig.health?.enabled ?? defaultConfig.health.enabled,
      path: userConfig.health?.path ?? defaultConfig.health.path
    },
    security: {
      headers: userConfig.security?.headers ?? defaultConfig.security.headers
    },
    dev: {
      reload: userConfig.dev?.reload ?? defaultConfig.dev.reload,
      watch: {
        debounce: userConfig.dev?.watch?.debounce ?? defaultConfig.dev.watch.debounce
      }
    }
  }
}

function resolveSessionSecret(secret: string | undefined): string {
  const resolved = secret || process.env.BORONIX_SESSION_SECRET
  if (resolved) return resolved

  if (getBoronixMode() === "development") {
    const globalSymbol = Symbol.for("boronix-warned-session-secret")
    if (!(globalThis as any)[globalSymbol]) {
      (globalThis as any)[globalSymbol] = true
      console.warn("⚠ session.secret is missing. Using an insecure development secret.")
    }
  }

  return defaultConfig.session.secret
}
