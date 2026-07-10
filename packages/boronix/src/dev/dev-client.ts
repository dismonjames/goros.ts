const DEV_CLIENT_SCRIPT = `<script data-boronix-dev-client>
(() => {
  if (window.__boronixDevClientConnected) return;
  window.__boronixDevClientConnected = true;
  let hasConnected = false;
  let disconnectedAfterConnect = false;
  let lastRevision = 0;
  const source = new EventSource("/__boronix/dev-events");
  const readRevision = (event) => {
    try { return Number(JSON.parse(event.data).revision || 0); } catch { return 0; }
  };
  source.addEventListener("connected", (event) => {
    const revision = readRevision(event);
    if (hasConnected && disconnectedAfterConnect && revision > lastRevision) {
      window.location.reload();
      return;
    }
    hasConnected = true;
    disconnectedAfterConnect = false;
    lastRevision = Math.max(lastRevision, revision);
  });
  source.addEventListener("reload", (event) => {
    const revision = readRevision(event);
    if (revision <= lastRevision) return;
    lastRevision = revision;
    window.location.reload();
  });
  source.onerror = () => {
    if (hasConnected) disconnectedAfterConnect = true;
  };
})();
</script>`

export function injectDevClient(html: string): string {
  if (html.includes("data-boronix-dev-client")) return html

  const bodyCloseIndex = html.search(/<\/body>/i)
  if (bodyCloseIndex !== -1) {
    return html.slice(0, bodyCloseIndex) + DEV_CLIENT_SCRIPT + html.slice(bodyCloseIndex)
  }

  return html + DEV_CLIENT_SCRIPT
}

export function shouldInjectDevClient(response: Response): boolean {
  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("text/html")) return false
  if (response.status >= 300 && response.status < 400) return false
  return true
}
