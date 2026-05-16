import { Buffer } from "node:buffer";
import { createServer, type IncomingMessage } from "node:http";

import { createApp, type CreateAppOptions } from "./app.js";
import { defaultDatabasePath, openDatabase, runMigrations } from "./db/index.js";

async function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

export async function createWebRequestFromIncomingMessage(
  req: IncomingMessage,
  origin: string,
): Promise<Request> {
  const requestInit: RequestInit = {
    method: req.method,
    headers: req.headers as HeadersInit,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    requestInit.body = await readRequestBody(req) as unknown as BodyInit;
  }

  return new Request(new URL(req.url ?? "/", origin), requestInit);
}

export function createHttpServer(options: CreateAppOptions = {}) {
  runStartupMigrations(options);
  const app = createApp(options);

  return createServer(async (req, res) => {
    try {
      const origin = `http://${req.headers.host ?? "127.0.0.1:3000"}`;
      const request = await createWebRequestFromIncomingMessage(req, origin);
      const response = await app(request);

      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));

      if (!response.body || req.method === "HEAD") {
        res.end();
        return;
      }

      const body = Buffer.from(await response.arrayBuffer());
      res.end(body);
    } catch {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("Internal server error");
    }
  });
}

function runStartupMigrations(options: CreateAppOptions) {
  if (options.db) {
    runMigrations(options.db);
    return;
  }

  const db = openDatabase({ path: defaultDatabasePath });

  try {
    runMigrations(db);
  } finally {
    db.close();
  }
}
