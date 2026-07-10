export type SupervisorToChildMessage =
  | { type: "shutdown"; reason: string }
  | { type: "broadcast-reload"; revision: number; reason: string; path?: string }

export type ChildToSupervisorMessage =
  | { type: "ready"; pid: number; port: number; host: string; revision: number }
  | { type: "error"; pid: number; revision: number; code?: string; message: string }
  | { type: "stopped"; pid: number; revision: number }

export const DEV_IPC_PREFIX = "__BORONIX_DEV_IPC__"

export function encodeDevMessage(message: ChildToSupervisorMessage): string {
  return `${DEV_IPC_PREFIX}${JSON.stringify(message)}`
}

export function decodeDevMessage(line: string): ChildToSupervisorMessage | undefined {
  if (!line.startsWith(DEV_IPC_PREFIX)) return undefined
  try {
    const value = JSON.parse(line.slice(DEV_IPC_PREFIX.length)) as ChildToSupervisorMessage
    if (!value || typeof value !== "object" || !("type" in value)) return undefined
    return value
  } catch {
    return undefined
  }
}
