/** Where a WebSocket upgrade goes. Only hot reload needs Next's, and only in development. */
export function upgradeTarget(url: string | undefined, dev: boolean): "relay" | "next" | "refuse" {
  let path: string;
  try {
    path = new URL(url ?? "", "http://x").pathname;
    if (!url?.startsWith("/") || url.startsWith("//") || url.includes("\\")) return "refuse";
  } catch {
    return "refuse";
  }
  if (path === "/ws") return "relay";
  return dev ? "next" : "refuse";
}
