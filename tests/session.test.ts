import { expect, test } from "bun:test"
import { defaultConfig } from "../packages/kumquat/src/config/types"
import { createSession, readSessionData, serializeSessionCookie } from "../packages/kumquat/src/core/session"

const sessionConfig = {
  ...defaultConfig.session,
  secret: "test-secret"
}

test("sets and gets session data", () => {
  const session = createSession(new Request("http://local/"), sessionConfig)
  session.set("user", { email: "demo@example.com" })

  expect(session.get<Record<string, string>>("user")).toEqual({ email: "demo@example.com" })
  expect(session.isDirty()).toBe(true)
})

test("reads valid signed cookie", () => {
  const cookie = serializeSessionCookie(sessionConfig, { user: "Minh" })
  const req = new Request("http://local/", {
    headers: {
      cookie
    }
  })

  expect(readSessionData(req, sessionConfig)).toEqual({ user: "Minh" })
})

test("ignores tampered cookie", () => {
  const cookie = serializeSessionCookie(sessionConfig, { user: "Minh" }).replace(/\.[^.;]+/, ".tampered")
  const req = new Request("http://local/", {
    headers: {
      cookie
    }
  })

  expect(readSessionData(req, sessionConfig)).toEqual({})
})

test("clears session data", () => {
  const session = createSession(new Request("http://local/"), sessionConfig)
  session.set("user", "Minh")
  session.clear()

  expect(session.get("user")).toBeNull()
})
