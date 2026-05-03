import { createServer } from "node:http";

import { createApp } from "./app.js";

export function createHttpServer() {
  const app = createApp();

  return createServer(async (req, res) => {
    const origin = `http://${req.headers.host ?? "127.0.0.1:3000"}`;
    const request = new Request(new URL(req.url ?? "/", origin), {
      method: req.method,
      headers: req.headers as HeadersInit,
    });

    const response = await app(request);

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));

    if (!response.body) {
      res.end();
      return;
    }

    const body = Buffer.from(await response.arrayBuffer());
    res.end(body);
  });
}
