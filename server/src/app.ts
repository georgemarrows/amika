import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

import { getHomePageData } from "../../shared/home-data.js";

const clientDistDir = join(process.cwd(), "dist", "client");

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers,
    },
  });
}

async function serveStaticAsset(pathname: string) {
  const candidate = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(candidate).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(clientDistDir, safePath);
  const file = await readFile(filePath);

  return new Response(file, {
    headers: {
      "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    },
  });
}

export function createApp() {
  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true });
    }

    if (url.pathname === "/api/home") {
      return json(getHomePageData());
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      return await serveStaticAsset(url.pathname);
    } catch {
      try {
        return await serveStaticAsset("/index.html");
      } catch {
        return new Response("Client build not found. Run `bun run build` first.", {
          status: 503,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
    }
  };
}
