import { existsSync, statSync } from "node:fs"
import path from "node:path"
import { getMimeType } from "./mime"

export async function servePublic(publicDir: string, url: URL): Promise<Response | null> {
  const decodedPath = decodeURIComponent(url.pathname)
  const relativePath = decodedPath.replace(/^\/+/, "")
  const filePath = path.resolve(publicDir, relativePath)
  const publicRoot = path.resolve(publicDir)
  const relativeToPublic = path.relative(publicRoot, filePath)

  if (relativeToPublic.startsWith("..") || path.isAbsolute(relativeToPublic)) {
    return new Response("Forbidden", { status: 403 })
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return null
  }

  const file = Bun.file(filePath)
  return new Response(file, {
    headers: {
      "content-type": getMimeType(filePath)
    }
  })
}
