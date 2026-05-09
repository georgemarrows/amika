import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

import { getHomePageData } from "../../shared/home-data.js";
import type { KanjiDetailResponse } from "../../shared/kanji-detail.js";
import type { KanjiListResponse, WordListResponse } from "../../shared/library-list.js";
import type { WordDetailResponse } from "../../shared/word-detail.js";
import {
  defaultDatabasePath,
  getKanjiByLiteral,
  getKanjiReadings,
  getMediaAssetById,
  getWordById,
  getWordsForKanji,
  listKanji,
  listWords,
  openDatabase,
  type Db,
  type KanjiRow,
  type MediaAssetRow,
  type WordDetailRow,
} from "./db/index.js";

const clientDistDir = join(process.cwd(), "dist", "client");
const defaultMediaRoot = join(process.cwd(), ".var", "media");
const libraryListLimit = 50;

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export type CreateAppOptions = {
  db?: Db;
  mediaRoot?: string;
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

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
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

function openRequestDb(options: CreateAppOptions) {
  if (options.db) {
    return { db: options.db, close: false };
  }

  return {
    db: openDatabase({
      path: defaultDatabasePath,
      readonly: true,
      fileMustExist: true,
    }),
    close: true,
  };
}

function mediaUrl(media: MediaAssetRow) {
  return `/api/media/${encodeURIComponent(media.id)}`;
}

function toKanjiDetailResponse(db: Db, kanji: KanjiRow): KanjiDetailResponse {
  return {
    literal: kanji.literal,
    meaning: kanji.primaryMeaning,
    strokeCount: kanji.strokeCount,
    frequencyRank: kanji.frequencyRank,
    usefulness: kanji.usefulness,
    strokeOrderImage: kanji.strokeOrderMedia
      ? {
          id: kanji.strokeOrderMedia.id,
          url: mediaUrl(kanji.strokeOrderMedia),
          contentType: kanji.strokeOrderMedia.contentType,
        }
      : null,
    components: [],
    readings: getKanjiReadings(db, kanji.literal).map((reading) => ({
      type: reading.type,
      reading: reading.reading,
      meaning: reading.meaning,
      usefulness: reading.usefulness,
    })),
    mnemonics: [],
    words: getWordsForKanji(db, kanji.literal),
    relations: [],
  };
}

function toWordDetailResponse(word: WordDetailRow): WordDetailResponse {
  return {
    id: word.id,
    expression: word.expression,
    reading: word.reading,
    primaryMeaning: word.primaryMeaning,
    usefulness: word.usefulness,
    meanings: word.meanings.map((meaning) => meaning.meaning),
    kanji: word.kanji.map((kanji) => ({
      literal: kanji.literal,
      meaning: kanji.meaning,
    })),
  };
}

function toKanjiListResponse(db: Db): KanjiListResponse {
  return {
    items: listKanji(db, libraryListLimit),
  };
}

function toWordListResponse(db: Db): WordListResponse {
  return {
    items: listWords(db, libraryListLimit),
  };
}

function mediaPathInRoot(media: MediaAssetRow, mediaRoot: string) {
  const root = resolve(mediaRoot);
  const filePath = resolve(media.storagePath);

  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    return null;
  }

  return filePath;
}

function routeSegment(pathname: string, prefix: string) {
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const segment = pathname.slice(prefix.length);

  if (segment === "" || segment.includes("/")) {
    return null;
  }

  return decodePathSegment(segment);
}

async function serveKanji(request: Request, literal: string, options: CreateAppOptions) {
  if (!isAllowed(request, ["GET", "HEAD"])) {
    return methodNotAllowed(["GET", "HEAD"]);
  }

  let handle: ReturnType<typeof openRequestDb>;

  try {
    handle = openRequestDb(options);
  } catch {
    return json({ error: "Kanji database unavailable" }, { status: 503 });
  }

  try {
    const kanji = getKanjiByLiteral(handle.db, literal);

    if (!kanji) {
      return json({ error: "Kanji not found" }, { status: 404 });
    }

    return json(toKanjiDetailResponse(handle.db, kanji));
  } catch {
    return json({ error: "Kanji database unavailable" }, { status: 503 });
  } finally {
    if (handle.close) {
      handle.db.close();
    }
  }
}

async function serveKanjiList(request: Request, options: CreateAppOptions) {
  if (!isAllowed(request, ["GET", "HEAD"])) {
    return methodNotAllowed(["GET", "HEAD"]);
  }

  let handle: ReturnType<typeof openRequestDb>;

  try {
    handle = openRequestDb(options);
  } catch {
    return json({ error: "Kanji database unavailable" }, { status: 503 });
  }

  try {
    return json(toKanjiListResponse(handle.db));
  } catch {
    return json({ error: "Kanji database unavailable" }, { status: 503 });
  } finally {
    if (handle.close) {
      handle.db.close();
    }
  }
}

async function serveWordList(request: Request, options: CreateAppOptions) {
  if (!isAllowed(request, ["GET", "HEAD"])) {
    return methodNotAllowed(["GET", "HEAD"]);
  }

  let handle: ReturnType<typeof openRequestDb>;

  try {
    handle = openRequestDb(options);
  } catch {
    return json({ error: "Word database unavailable" }, { status: 503 });
  }

  try {
    return json(toWordListResponse(handle.db));
  } catch {
    return json({ error: "Word database unavailable" }, { status: 503 });
  } finally {
    if (handle.close) {
      handle.db.close();
    }
  }
}

async function serveWord(request: Request, id: string, options: CreateAppOptions) {
  if (!isAllowed(request, ["GET", "HEAD"])) {
    return methodNotAllowed(["GET", "HEAD"]);
  }

  let handle: ReturnType<typeof openRequestDb>;

  try {
    handle = openRequestDb(options);
  } catch {
    return json({ error: "Word database unavailable" }, { status: 503 });
  }

  try {
    const word = getWordById(handle.db, id);

    if (!word) {
      return json({ error: "Word not found" }, { status: 404 });
    }

    return json(toWordDetailResponse(word));
  } catch {
    return json({ error: "Word database unavailable" }, { status: 503 });
  } finally {
    if (handle.close) {
      handle.db.close();
    }
  }
}

async function serveMedia(request: Request, id: string, options: CreateAppOptions) {
  if (!isAllowed(request, ["GET", "HEAD"])) {
    return methodNotAllowed(["GET", "HEAD"]);
  }

  let handle: ReturnType<typeof openRequestDb>;

  try {
    handle = openRequestDb(options);
  } catch {
    return json({ error: "Media database unavailable" }, { status: 503 });
  }

  try {
    const media = getMediaAssetById(handle.db, id);

    if (!media) {
      return json({ error: "Media not found" }, { status: 404 });
    }

    const filePath = mediaPathInRoot(media, options.mediaRoot ?? defaultMediaRoot);

    if (!filePath) {
      return json({ error: "Media not found" }, { status: 404 });
    }

    try {
      const file = await readFile(filePath);

      return new Response(file, {
        headers: {
          "content-type": media.contentType ?? contentTypes[extname(filePath)] ?? "application/octet-stream",
        },
      });
    } catch {
      return json({ error: "Media not found" }, { status: 404 });
    }
  } catch {
    return json({ error: "Media database unavailable" }, { status: 503 });
  } finally {
    if (handle.close) {
      handle.db.close();
    }
  }
}

export function createApp(options: CreateAppOptions = {}) {
  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/kanji") {
      return serveKanjiList(request, options);
    }

    const kanjiLiteral = routeSegment(url.pathname, "/api/kanji/");

    if (kanjiLiteral !== null) {
      return serveKanji(request, kanjiLiteral, options);
    }

    if (url.pathname === "/api/words") {
      return serveWordList(request, options);
    }

    const wordId = routeSegment(url.pathname, "/api/words/");
    if (wordId !== null) {
      return serveWord(request, wordId, options);
    }

    const mediaId = routeSegment(url.pathname, "/api/media/");

    if (mediaId !== null) {
      return serveMedia(request, mediaId, options);
    }

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
