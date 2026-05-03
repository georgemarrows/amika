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

function methodNotAllowed(allowed: string[]) {
  return new Response("Method not allowed", {
    status: 405,
    headers: {
      allow: allowed.join(", "),
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

function isAllowed(request: Request, allowed: string[]) {
  return allowed.includes(request.method);
}

function isNavigationRequest(request: Request, pathname: string) {
  if (!isAllowed(request, ["GET", "HEAD"])) {
    return false;
  }

  if (extname(pathname) !== "") {
    return false;
  }

  return request.headers.get("accept")?.includes("text/html") ?? true;
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
      if (!isAllowed(request, ["GET", "HEAD"])) {
        return methodNotAllowed(["GET", "HEAD"]);
      }

      return json({ ok: true });
    }

    if (url.pathname === "/api/home") {
      if (!isAllowed(request, ["GET", "HEAD"])) {
        return methodNotAllowed(["GET", "HEAD"]);
      }

      return json(getHomePageData());
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, { status: 404 });
    }

    if (!isAllowed(request, ["GET", "HEAD"])) {
      return methodNotAllowed(["GET", "HEAD"]);
    }

    try {
      return await serveStaticAsset(url.pathname);
    } catch {
      if (!isNavigationRequest(request, url.pathname)) {
        return new Response("Not found", {
          status: 404,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }

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
