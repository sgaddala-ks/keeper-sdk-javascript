/**
 * Keeper Web Console API — Express server for the `<web-console>` component.
 * Contract: POST /api/cli with JSON `{ "line": string }` → `{ code, out, err }`.
 * Lines are tokenized like a shell (quotes, escapes); GNU-style `-` / `--` options are supported.
 * POST /api/cli/complete with JSON `{ "line": string }` → `{ base, candidates }` (Tab completion).
 * POST /api/cli/login with JSON `{ username, password? }` or `{ username, sessionToken?, sessionTokenPlain? }`.
 * Commands are parsed in cliDispatch.ts; Keeper vault ops use KeeperSdk in keeperCommands.ts.
 */
import express, { type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { dispatchCliLine } from "./cliDispatch.js";
import { completeCliLine } from "./cliComplete.js";
import {
  loginWithCredentials,
  loginWithSessionTokenCredentials,
} from "./keeperCommands.js";

const isProd = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || 3042;
const HOST = process.env.HOST ?? (isProd ? "0.0.0.0" : "127.0.0.1");
const JSON_LIMIT = process.env.JSON_BODY_LIMIT || "32kb";

const app = express();
if (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: isProd ? undefined : false,
  })
);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (allowedOrigins.length > 0) {
  app.use(cors({ origin: allowedOrigins }));
}

app.use(express.json({ limit: JSON_LIMIT }));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", backend: "keeper-sdk-javascript" });
});

const cliLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.RATE_LIMIT_MAX) || 120,
  standardHeaders: true,
  legacyHeaders: false,
});

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

app.post(
  "/api/cli",
  cliLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { line?: unknown } | undefined;
    const line = body?.line;
    if (typeof line !== "string") {
      res.status(400).json({ error: "line required" });
      return;
    }

    res.json(await dispatchCliLine(line));
  })
);

app.post(
  "/api/cli/complete",
  cliLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { line?: unknown } | undefined;
    const line = body?.line;
    if (typeof line !== "string") {
      res.status(400).json({ error: "line required" });
      return;
    }

    res.json(completeCliLine(line));
  })
);

app.post(
  "/api/cli/login",
  cliLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as {
      username?: unknown;
      password?: unknown;
      sessionToken?: unknown;
      sessionTokenPlain?: unknown;
    } | undefined;
    const username = body?.username;
    if (typeof username !== "string") {
      res.status(400).json({ error: "username (string) required" });
      return;
    }

    const sessionToken = body?.sessionToken;
    if (typeof sessionToken === "string" && sessionToken.trim().length > 0) {
      const plain =
        body?.sessionTokenPlain === true ||
        body?.sessionTokenPlain === "true" ||
        body?.sessionTokenPlain === 1;
      res.json(await loginWithSessionTokenCredentials(username, sessionToken, { plainToken: plain }));
      return;
    }

    const password = body?.password;
    if (typeof password !== "string") {
      res.status(400).json({
        error: "password or non-empty sessionToken (string) required",
      });
      return;
    }

    res.json(await loginWithCredentials(username, password));
  })
);

app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || 500;
  console.error(err);
  const message =
    isProd && status === 500 ? "internal error" : err.message || "internal error";
  res.status(status).json({ error: message });
});

const server = app.listen(PORT, HOST, () => {
  console.log(
    `Webconsole API (KeeperSdk) http://${HOST}:${PORT} (NODE_ENV=${process.env.NODE_ENV || "development"})`
  );
});

const shutdown = (signal: string) => {
  console.log(`${signal} received, closing`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
