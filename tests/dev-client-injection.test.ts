import { expect, test } from "bun:test"
import { injectDevClient, shouldInjectDevClient } from "../packages/boronix/src/dev/dev-client"

test("inject dev client before </body>", () => {
  const html = "<html><body><h1>Hello</h1></body></html>"
  const result = injectDevClient(html)
  expect(result).toContain("data-boronix-dev-client")
  expect(result.indexOf("data-boronix-dev-client")).toBeLessThan(result.indexOf("</body>"))
})

test("inject dev client at end if no </body>", () => {
  const html = "<html><body><h1>Hello</h1></html>"
  const result = injectDevClient(html)
  expect(result).toContain("data-boronix-dev-client")
  expect(result.endsWith("</script>") || result.includes("</html>")).toBe(true)
})

test("do not inject twice", () => {
  const html = "<html><body><h1>Hello</h1></body></html>"
  const once = injectDevClient(html)
  const twice = injectDevClient(once)
  const matches = twice.match(/data-boronix-dev-client/g)
  expect(matches).toHaveLength(1)
})

test("shouldInjectDevClient returns true for HTML 200", () => {
  const res = new Response("<html></html>", {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" }
  })
  expect(shouldInjectDevClient(res)).toBe(true)
})

test("shouldInjectDevClient returns false for JSON", () => {
  const res = new Response("{}", {
    status: 200,
    headers: { "content-type": "application/json" }
  })
  expect(shouldInjectDevClient(res)).toBe(false)
})

test("shouldInjectDevClient returns false for redirect", () => {
  const res = new Response(null, {
    status: 302,
    headers: { "content-type": "text/html", "location": "/login" }
  })
  expect(shouldInjectDevClient(res)).toBe(false)
})

test("shouldInjectDevClient returns false for non-HTML content-type", () => {
  const res = new Response("body{}", {
    status: 200,
    headers: { "content-type": "text/css" }
  })
  expect(shouldInjectDevClient(res)).toBe(false)
})

test("dev client contains EventSource connection", () => {
  const html = "<html><body></body></html>"
  const result = injectDevClient(html)
  expect(result).toContain("EventSource")
  expect(result).toContain("/__boronix/dev-events")
})
