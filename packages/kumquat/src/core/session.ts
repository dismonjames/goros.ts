import { createHmac, timingSafeEqual } from "node:crypto"
import type { ResolvedKumquatConfig } from "../config/types"

export type Session = {
  get<T = unknown>(key: string): T | null
  set(key: string, value: unknown): void
  delete(key: string): void
  clear(): void
}

type SessionPayload = {
  data: Record<string, unknown>
  exp: number
}

type InternalSession = Session & {
  isDirty(): boolean
  commit(): string
}

export function createSession(req: Request, config: ResolvedKumquatConfig["session"]): InternalSession {
  let data = readSessionData(req, config)
  let dirty = false

  return {
    get<T = unknown>(key: string): T | null {
      return key in data ? (data[key] as T) : null
    },
    set(key: string, value: unknown): void {
      data[key] = value
      dirty = true
    },
    delete(key: string): void {
      if (key in data) {
        delete data[key]
        dirty = true
      }
    },
    clear(): void {
      data = {}
      dirty = true
    },
    isDirty(): boolean {
      return dirty
    },
    commit(): string {
      return serializeSessionCookie(config, data)
    }
  }
}

export function commitSession(response: Response, session: InternalSession): Response {
  if (!session.isDirty()) return response

  const headers = new Headers(response.headers)
  headers.append("set-cookie", session.commit())

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

export function serializeSessionCookie(config: ResolvedKumquatConfig["session"], data: Record<string, unknown>): string {
  const payload: SessionPayload = {
    data,
    exp: Math.floor(Date.now() / 1000) + config.maxAge
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = sign(encodedPayload, config.secret)
  const parts = [
    `${config.name}=${encodedPayload}.${signature}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${config.maxAge}`,
    `SameSite=${formatSameSite(config.sameSite)}`
  ]

  if (config.secure) {
    parts.push("Secure")
  }

  return parts.join("; ")
}

export function readSessionData(req: Request, config: ResolvedKumquatConfig["session"]): Record<string, unknown> {
  const value = parseCookies(req.headers.get("cookie") ?? "")[config.name]
  if (!value) return {}

  const [payload, signature] = value.split(".")
  if (!payload || !signature || !verify(payload, signature, config.secret)) {
    return {}
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as SessionPayload
    if (!parsed || typeof parsed !== "object" || !parsed.data || typeof parsed.data !== "object") {
      return {}
    }
    if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) {
      return {}
    }
    return parsed.data
  } catch {
    return {}
  }
}

export function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=")
    if (!rawName || rawValue.length === 0) continue
    cookies[rawName] = rawValue.join("=")
  }

  return cookies
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

function verify(payload: string, signature: string, secret: string): boolean {
  const expected = sign(payload, secret)
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(signature)
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8")
}

function formatSameSite(value: "lax" | "strict" | "none"): string {
  if (value === "strict") return "Strict"
  if (value === "none") return "None"
  return "Lax"
}
