import {
  isAllowedKeeperProxyHost,
  KEEPER_REST_PROXY_PREFIX,
  KEEPER_WSS_PROXY_PREFIX,
} from "./keeperProxyHosts.js";

function shouldProxyUrl(url: URL): boolean {
  return isAllowedKeeperProxyHost(url.hostname);
}

function rewriteKeeperUrl(url: string): string {
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.href : undefined);
    if (!shouldProxyUrl(u)) return url;

    const ws = u.protocol === "wss:" || u.protocol === "ws:";
    const prefix = ws ? KEEPER_WSS_PROXY_PREFIX : KEEPER_REST_PROXY_PREFIX;
    const proto =
      window.location.protocol === "https:"
        ? ws
          ? "wss:"
          : "https:"
        : ws
          ? "ws:"
          : "http:";

    return `${proto}//${window.location.host}${prefix}${u.host}${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

/** Dev: rewrite Keeper fetch/WebSocket URLs to the same-origin Vite proxy prefixes. */
export function installKeeperSameOriginProxy(): void {
  if (typeof window === "undefined") return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string") {
      return nativeFetch(rewriteKeeperUrl(input), init);
    }
    if (input instanceof Request) {
      const next = rewriteKeeperUrl(input.url);
      return next === input.url
        ? nativeFetch(input, init)
        : nativeFetch(new Request(next, input), init);
    }
    return nativeFetch(input, init);
  }) as typeof fetch;

  const NativeWebSocket = window.WebSocket;
  window.WebSocket = new Proxy(NativeWebSocket, {
    construct(_target, args: [string | URL, (string | string[])?]) {
      const [url, protocols] = args;
      return new NativeWebSocket(rewriteKeeperUrl(String(url)), protocols);
    },
  }) as typeof WebSocket;

  if (import.meta.env?.DEV === true) {
    console.info(
      "[keeper-shell] Same-origin dev proxy enabled:",
      KEEPER_REST_PROXY_PREFIX,
      KEEPER_WSS_PROXY_PREFIX
    );
  }
}
