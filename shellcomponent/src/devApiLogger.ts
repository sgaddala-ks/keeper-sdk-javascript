/**
 * Dev-only: wrap `fetch` to log Keeper / keeperapi HTTP calls (URL, method, headers, body summary).
 * Loaded from dev-bootstrap only. {@link installKeeperDevFetchLogger} returns immediately unless
 * `import.meta.env.DEV === true` (e.g. Vite dev server).
 *
 * Note: When a request fails, DevTools often shows `at … devApiLogger.ts` — that is this wrapper
 * delegating to the real `fetch`. The failure is still from the Keeper API call (e.g. CORS from
 * localhost), not a bug in this logger.
 */
const REDACT_KEYS = new Set(["authorization", "cookie", "set-cookie"]);

function sanitizeHeaders(entries: Iterable<[string, string]>): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of entries) {
    o[k] = REDACT_KEYS.has(k.toLowerCase()) ? "[redacted]" : v;
  }
  return o;
}

function hexPreview(u8: Uint8Array, maxBytes = 64): string {
  const n = Math.min(maxBytes, u8.byteLength);
  let s = "";
  for (let i = 0; i < n; i++) s += u8[i]!.toString(16).padStart(2, "0");
  if (u8.byteLength > n) s += "…";
  return s || "(empty)";
}

function summarizeBody(body: BodyInit | null | undefined): unknown {
  if (body == null) return null;
  if (typeof body === "string") {
    const max = 4000;
    return {
      kind: "string",
      length: body.length,
      preview: body.length > max ? `${body.slice(0, max)}…` : body,
    };
  }
  if (body instanceof URLSearchParams) {
    return { kind: "URLSearchParams", string: body.toString() };
  }
  if (body instanceof FormData) {
    return { kind: "FormData", keys: [...body.keys()] };
  }
  if (body instanceof Blob) {
    return { kind: "Blob", size: body.size, type: body.type || "(no type)" };
  }
  if (body instanceof ArrayBuffer) {
    const u8 = new Uint8Array(body, 0, Math.min(64, body.byteLength));
    return { kind: "ArrayBuffer", byteLength: body.byteLength, headHex: hexPreview(u8) };
  }
  if (ArrayBuffer.isView(body)) {
    const u8 = new Uint8Array(body.buffer, body.byteOffset, Math.min(64, body.byteLength));
    return {
      kind: "ArrayBufferView",
      byteLength: body.byteLength,
      headHex: hexPreview(u8),
    };
  }
  return { kind: Object.prototype.toString.call(body) };
}

let installed = false;

export function installKeeperDevFetchLogger(): void {
  if (installed) return;
  if (import.meta.env?.DEV !== true) return;
  installed = true;

  const orig = globalThis.fetch.bind(globalThis);
  let seq = 0;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const id = ++seq;
    let url = "";
    let method = "GET";
    let headersObj: Record<string, string> = {};
    let bodySummary: unknown = null;

    if (typeof input === "string" || input instanceof URL) {
      url = typeof input === "string" ? input : input.href;
      method = (init?.method ?? "GET").toUpperCase();
      if (init?.headers) headersObj = sanitizeHeaders(new Headers(init.headers as HeadersInit).entries());
      bodySummary = summarizeBody(init?.body ?? undefined);
    } else {
      url = input.url;
      method = (init?.method ?? input.method ?? "GET").toUpperCase();
      const merged = new Headers(input.headers);
      if (init?.headers) {
        new Headers(init.headers as HeadersInit).forEach((v, k) => merged.set(k, v));
      }
      headersObj = sanitizeHeaders(merged.entries());
      bodySummary =
        init?.body != null
          ? summarizeBody(init.body)
          : { note: "body on Request object (stream); not duplicated here" };
    }

    const label = `[keeper-shell dev] HTTP #${id} ${method} ${url}`;
    console.groupCollapsed(label);
    console.log("request headers", headersObj);
    console.log("request body summary", bodySummary);
    const t0 = performance.now();
    try {
      const res = await orig(input, init);
      const ms = Math.round(performance.now() - t0);
      console.log("response", { status: res.status, ok: res.ok, elapsedMs: ms });
      console.groupEnd();
      return res;
    } catch (err) {
      const ms = Math.round(performance.now() - t0);
      console.error(
        "%c[keeper-shell dev] FETCH FAILED%c — root cause is the request below (often CORS / offline / wrong vault host), not this wrapper file.",
        "color:#b91c1c;font-weight:bold",
        "color:inherit",
        { id, method, url, elapsedMs: ms }
      );
      console.error("Original error (expand .cause on augmented error if present):", err);
      console.groupEnd();

      const baseMsg = err instanceof Error ? err.message : String(err);
      const augmented = new TypeError(
        `${baseMsg} — ${method} ${url}\n` +
          "(Dev fetch logger: stack frames in devApiLogger.ts are the wrapped fetch call; check Network tab for the real HTTP/CORS outcome.)"
      );
      if (err instanceof Error) {
        augmented.cause = err;
      }
      throw augmented;
    }
  };

  console.info(
    "%c[keeper-shell dev]%c fetch logging enabled",
    "color:#0a0;font-weight:bold",
    "color:inherit"
  );
}
