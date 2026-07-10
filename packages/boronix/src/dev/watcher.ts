import { watch, type FSWatcher } from "node:fs"
import path from "node:path"
import { isIgnoredPath } from "./change-classifier"
import type { DevFileChangeEvent, DevFileChange } from "./types"

export type WatcherOptions = {
  root: string
  watchPaths: string[]
  debounceMs?: number | undefined
  onChange: (changes: DevFileChange[]) => void
  debug?: boolean | undefined
}

type PendingEvent = {
  event: DevFileChangeEvent
  absolutePath: string
  timestamp: number
}

export type FileWatcher = {
  close(): void
}

export function createFileWatcher(options: WatcherOptions): FileWatcher {
  const debounceMs = options.debounceMs ?? 50
  const root = options.root
  const watchers: FSWatcher[] = []
  let pending = new Map<string, PendingEvent>()
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let closed = false

  function scheduleFlush(): void {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      flush()
    }, debounceMs)
  }

  function flush(): void {
    debounceTimer = null
    if (closed) return
    if (pending.size === 0) return

    const changes: DevFileChange[] = []
    const events = [...pending.values()]
    pending.clear()

    for (const evt of events) {
      const relativePath = path.relative(root, evt.absolutePath).split(path.sep).join("/")
      if (isIgnoredPath(relativePath)) continue

      changes.push({
        event: evt.event,
        kind: "unknown",
        absolutePath: evt.absolutePath,
        relativePath,
        detectedAt: evt.timestamp
      })
    }

    if (changes.length > 0) {
      if (options.debug) {
        for (const c of changes) {
          console.log(`watch ${c.event} ${c.relativePath}`)
        }
      }
      try {
        options.onChange(changes)
      } catch {}
    }
  }

  function handleEvent(eventName: DevFileChangeEvent, filePath: string): void {
    if (closed) return
    const absolutePath = path.resolve(filePath)
    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/")
    if (isIgnoredPath(relativePath)) return

    const existing = pending.get(absolutePath)
    if (existing) {
      if (existing.event === "remove" && eventName === "create") {
        pending.set(absolutePath, { event: "modify", absolutePath, timestamp: Date.now() })
      } else if (existing.event === "create" && eventName === "remove") {
        pending.delete(absolutePath)
      } else if (eventName === "rename") {
        pending.set(absolutePath, { event: "rename", absolutePath, timestamp: Date.now() })
      } else {
        existing.timestamp = Date.now()
      }
    } else {
      pending.set(absolutePath, { event: eventName, absolutePath, timestamp: Date.now() })
    }

    scheduleFlush()
  }

  for (const watchPath of options.watchPaths) {
    try {
      const w = watch(watchPath, { recursive: true }, (event, filename) => {
        if (!filename) return
        const fullPath = path.join(watchPath, filename)
        const evt: DevFileChangeEvent = event === "rename" ? "rename" : "modify"
        handleEvent(evt, fullPath)
      })
      watchers.push(w)
    } catch {
      try {
        const w = watch(watchPath, { recursive: false }, (event, filename) => {
          if (!filename) return
          const fullPath = path.join(watchPath, filename)
          const evt: DevFileChangeEvent = event === "rename" ? "rename" : "modify"
          handleEvent(evt, fullPath)
        })
        watchers.push(w)
      } catch {}
    }
  }

  return {
    close(): void {
      closed = true
      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
      pending.clear()
      for (const w of watchers) {
        try {
          w.close()
        } catch {}
      }
    }
  }
}
