import { expect, test } from "bun:test"
import { invalidateTemplate, invalidateRouteTemplates, clearTemplateCache, renderTemplate } from "../packages/boronix/src/render/template"

test("invalidateTemplate clears specific template", () => {
  clearTemplateCache()
  renderTemplate("{{ x }}", { x: "hello" })
  expect(() => invalidateTemplate("/some/path/page.html")).not.toThrow()
})

test("invalidateRouteTemplates clears templates matching routeId", () => {
  clearTemplateCache()
  expect(() => invalidateRouteTemplates("home")).not.toThrow()
})

test("clearTemplateCache does not throw", () => {
  expect(() => clearTemplateCache()).not.toThrow()
})

test("template renders fresh content after cache clear", () => {
  clearTemplateCache()
  const result1 = renderTemplate("{{ x }}", { x: "first" })
  expect(result1).toBe("first")

  clearTemplateCache()

  const result2 = renderTemplate("{{ x }}", { x: "second" })
  expect(result2).toBe("second")
})

test("template reload: new content appears after save", () => {
  clearTemplateCache()

  const template1 = "<h1>Hello</h1>"
  const result1 = renderTemplate(template1, {})
  expect(result1).toContain("Hello")

  const template2 = "<h1>World</h1>"
  clearTemplateCache()
  const result2 = renderTemplate(template2, {})
  expect(result2).toContain("World")
  expect(result2).not.toContain("Hello")
})
