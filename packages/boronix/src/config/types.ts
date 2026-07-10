export type BoronixConfig = {
  runtime?: "bun" | "node" | "deno"
  server?: {
    port?: number
    host?: string
  }
  session?: {
    name?: string
    secret?: string
    maxAge?: number
    sameSite?: "lax" | "strict" | "none"
    secure?: boolean
  }
  app?: {
    root?: string
    routesDir?: string
    publicDir?: string
  }
  cli?: {
    color?: boolean
    unicode?: boolean
    requestLog?: boolean
    groupRoutes?: boolean
  }
  health?: {
    enabled?: boolean
    path?: string
  }
  security?: {
    headers?: boolean | {
      contentTypeOptions?: string
      referrerPolicy?: string
      frameOptions?: string
    }
  }
  dev?: {
    reload?: boolean
    watch?: {
      debounce?: number
    }
  }
}

export type ResolvedBoronixConfig = {
  runtime: "bun" | "node" | "deno"
  server: {
    port: number
    host: string
  }
  session: {
    name: string
    secret: string
    maxAge: number
    sameSite: "lax" | "strict" | "none"
    secure: boolean
  }
  app: {
    root: string
    routesDir: string
    publicDir: string
  }
  cli: {
    color: boolean
    unicode: boolean
    requestLog: boolean
    groupRoutes: boolean
  }
  health: {
    enabled: boolean
    path: string
  }
  security: {
    headers: boolean | {
      contentTypeOptions?: string
      referrerPolicy?: string
      frameOptions?: string
    }
  }
  dev: {
    reload: boolean
    watch: {
      debounce: number
    }
  }
}

export const defaultConfig: ResolvedBoronixConfig = {
  runtime: "bun",
  server: {
    port: 3000,
    host: "0.0.0.0"
  },
  session: {
    name: "kq_session",
    secret: "boronix-dev-session-secret",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: false
  },
  app: {
    root: "app",
    routesDir: "app/routes",
    publicDir: "public"
  },
  cli: {
    color: true,
    unicode: true,
    requestLog: true,
    groupRoutes: true
  },
  health: {
    enabled: false,
    path: "/health"
  },
  security: {
    headers: true
  },
  dev: {
    reload: true,
    watch: {
      debounce: 50
    }
  }
}
