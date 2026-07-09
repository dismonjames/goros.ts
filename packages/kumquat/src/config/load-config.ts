import { existsSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { resolvePath } from "../utils/path"
import { defaultConfig, type KumquatConfig, type ResolvedKumquatConfig } from "./types"

export async function loadConfig(root: string): Promise<ResolvedKumquatConfig> {
  const configPath = resolvePath(root, "kumquat.config.ts")
  let userConfig: KumquatConfig = {}

  if (existsSync(configPath)) {
    const module = await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`)
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
    }
  }
}

function resolveSessionSecret(secret: string | undefined): string {
  if (secret) return secret

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing session.secret. Set session.secret or SESSION_SECRET before running in production.")
  }

  console.warn("Kumquat session.secret is missing. Using an insecure development secret.")
  return defaultConfig.session.secret
}
