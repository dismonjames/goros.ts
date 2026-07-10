import { createBoronixApp, type BoronixAppOptions } from "../core/app"
import type { ResolvedBoronixConfig } from "../config/types"
import type { RouteManifest } from "../scanner/route-manifest"
import { injectDevClient, shouldInjectDevClient } from "./dev-client"
import { resolvePath } from "../utils/path"
import type { ReloadChannel } from "./reload-channel"

export type DevAppOptions = {
  root: string
  config: ResolvedBoronixConfig
  manifest: RouteManifest
  channel: ReloadChannel
  quiet?: boolean | undefined
  verbose?: boolean | undefined
  plain?: boolean | undefined
}

export type DevApp = {
  fetch(req: Request): Promise<Response>
  reload(manifest: RouteManifest, config: ResolvedBoronixConfig): void
  getCurrentManifest(): RouteManifest
  getCurrentConfig(): ResolvedBoronixConfig
}

export function createDevApp(options: DevAppOptions): DevApp {
  let currentManifest = options.manifest
  let currentConfig = options.config
  let currentApp = createBoronixApp({
    root: options.root,
    config: currentConfig,
    manifest: currentManifest,
    dev: true,
    quiet: options.quiet,
    verbose: options.verbose,
    plain: options.plain
  })

  function reload(manifest: RouteManifest, config: ResolvedBoronixConfig): void {
    currentManifest = manifest
    currentConfig = config
    currentApp = createBoronixApp({
      root: options.root,
      config: currentConfig,
      manifest: currentManifest,
      dev: true,
      quiet: options.quiet,
      verbose: options.verbose,
      plain: options.plain
    })
  }

  async function fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname === "/__boronix/dev-events" && req.method === "GET") {
      return options.channel.handleSSE(req)
    }

    const response = await currentApp.fetch(req)

    if (response.status >= 200 && response.status < 300 && shouldInjectDevClient(response)) {
      const text = await response.text()
      const injected = injectDevClient(text)
      return new Response(injected, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })
    }

    return response
  }

  return {
    fetch,
    reload,
    getCurrentManifest: () => currentManifest,
    getCurrentConfig: () => currentConfig
  }
}
