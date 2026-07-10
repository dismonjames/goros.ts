export type DevChangeKind =
  | "template"
  | "route-module"
  | "shared-module"
  | "public-asset"
  | "route-structure"
  | "config"
  | "env"
  | "unknown"

export type DevFileChangeEvent = "create" | "modify" | "remove" | "rename"

export type DevFileChange = {
  event: DevFileChangeEvent
  kind: DevChangeKind
  absolutePath: string
  relativePath: string
  detectedAt: number
}

export type DevReloadEvent =
  | {
      type: "reload"
      reason: string
      path?: string
      revision: number
    }
  | {
      type: "connected"
      revision: number
    }
  | {
      type: "error"
      message: string
      revision: number
    }

export type ReloadResult = {
  ok: boolean
  kind: DevChangeKind
  revision: number
  durationMs: number
  routesRescanned: boolean
  error?: unknown
}

export type DevWatchConfig = {
  debounce?: number
}

export type DevConfig = {
  reload?: boolean
  watch?: DevWatchConfig
}
