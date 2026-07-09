import { defineConfig } from "kumquat"

export default defineConfig({
  runtime: "bun",
  session: {
    secret: process.env.SESSION_SECRET ?? "homework-dev-secret",
    sameSite: "lax",
    secure: false
  },
  server: {
    port: 3000,
    host: "0.0.0.0"
  },
  app: {
    root: "app",
    routesDir: "app/routes",
    publicDir: "public"
  }
})
