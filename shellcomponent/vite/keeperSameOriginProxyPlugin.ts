import type { Plugin } from "vite";
import httpProxy from "http-proxy";
import { isAllowedKeeperProxyHost } from "../src/dev/keeperProxyHosts.js";

/**
 * Vite dev server: forward same-origin `/__keeper/<host>/…` and `/__keeper-wss/<host>/…`
 * to real Keeper HTTPS/WSS endpoints (avoids browser CORS while SDK runs in-page).
 */
export function keeperSameOriginProxyPlugin(): Plugin {
  const proxy = httpProxy.createProxyServer({
    changeOrigin: true,
    secure: true,
    ws: true,
  });

  return {
    name: "keeper-same-origin-proxy",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? "";
        const match = raw.match(/^\/__keeper\/([^/]+)(\/.*)?$/);
        if (!match) {
          next();
          return;
        }
        const targetHost = match[1];
        if (!isAllowedKeeperProxyHost(targetHost)) {
          res.statusCode = 403;
          res.end("Forbidden keeper proxy host");
          return;
        }
        req.url = match[2] ?? "/";
        proxy.web(
          req,
          res,
          { target: `https://${targetHost}` },
          (err) => {
            if (err) next(err);
          }
        );
      });

      server.httpServer?.on("upgrade", (req, socket, head) => {
        const raw = req.url ?? "";
        const match = raw.match(/^\/__keeper-wss\/([^/]+)(\/.*)?$/);
        if (!match) return;
        const targetHost = match[1];
        if (!isAllowedKeeperProxyHost(targetHost)) {
          socket.destroy();
          return;
        }
        req.url = match[2] ?? "/";
        proxy.ws(req, socket, head, { target: `wss://${targetHost}` });
      });
    },
  };
}
