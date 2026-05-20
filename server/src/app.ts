import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

import { Hono, type Handler } from "hono";

import { getHomePageData } from "../../shared/home-data.js";
import type { KanjiDetailResponse } from "../../shared/kanji-detail.js";
import type { KanjiListResponse, WordListResponse } from "../../shared/library-list.js";
import type { SearchResponse } from "../../shared/search.js";
import type {
  KanjiSrsStatusResponse,
  SrsApiErrorCode,
  SrsApiErrorResponse,
  SrsCardSummary,
  SrsDueStatus,
  SrsKanjiMatrixResponse,
  SrsReviewCardResponse,
  SrsReviewQueueResponse,
  SrsReviewRating,
  SrsReviewSubmitResponse,
} from "../../shared/srs.js";
import type { WordDetailResponse } from "../../shared/word-detail.js";
import { reviewSrsCard, SrsReviewError } from "./srs/review-service.js";
import type { SrsCard as DomainSrsCard } from "./srs/types.js";
import {
  countDueSrsCards,
  defaultDatabasePath,
  disableKanjiSrs,
  enableKanjiSrs,
  getKanjiByLiteral,
  getKanjiReadings,
  getMediaAssetById,
  getNextDueSrsCard,
  getWordById,
  getWordsForKanji,
  getSrsCardsForKanji,
  listKanji,
  listWords,
  listSrsKanjiMatrixRows,
  openDatabase,
  searchLibrary,
  type Db,
  type KanjiRow,
  type MediaAssetRow,
  type WordDetailRow,
} from "./db/index.js";

const clientDistDir = join(process.cwd(), "dist", "client");
const defaultMediaRoot = join(process.cwd(), ".var", "media");
const libraryListLimit = 50;
const getAndHeadMethods = ["GET", "HEAD"];
const postMethods = ["POST"];
const reviewRatings = new Set<SrsReviewRating>(["again", "hard", "good", "easy"]);

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

function methodNotAllowed(allow = getAndHeadMethods) {
  return new Response("Method not allowed", {
    status: 405,
    headers: {
      allow: getAndHeadMethods.join(", "),
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

function isGetOrHead(request: Request) {
  return getAndHeadMethods.includes(request.method);
}

function isNavigationRequest(request: Request, pathname: string) {
  if (!isGetOrHead(request)) {
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

function openWriteRequestDb(options: CreateAppOptions) {
  if (options.db) {
    return { db: options.db, close: false };
  }

  return {
    db: openDatabase({
      path: defaultDatabasePath,
      fileMustExist: true,
    }),
    close: true,
  };
}

async function withRequestDb(
  options: CreateAppOptions,
  unavailableError: string,
  handler: (db: Db) => Response | Promise<Response>,
) {
  let handle: ReturnType<typeof openRequestDb>;

  try {
    handle = openRequestDb(options);
  } catch {
    return json({ error: unavailableError }, { status: 503 });
  }

  try {
    return await handler(handle.db);
  } catch {
    return json({ error: unavailableError }, { status: 503 });
  } finally {
    if (handle.close) {
      handle.db.close();
    }
  }
}

async function withWriteRequestDb(
  options: CreateAppOptions,
  handler: (db: Db) => Response | Promise<Response>,
) {
  let handle: ReturnType<typeof openWriteRequestDb>;

  try {
    handle = openWriteRequestDb(options);
  } catch {
    return srsError("database_unavailable", "SRS database unavailable", 503);
  }

  try {
    return await handler(handle.db);
  } catch {
    return srsError("database_unavailable", "SRS database unavailable", 503);
  } finally {
    if (handle.close) {
      handle.db.close();
    }
  }
}

async function withSrsRequestDb(
  options: CreateAppOptions,
  handler: (db: Db) => Response | Promise<Response>,
) {
  let handle: ReturnType<typeof openRequestDb>;

  try {
    handle = openRequestDb(options);
  } catch {
    return srsError("database_unavailable", "SRS database unavailable", 503);
  }

  try {
    return await handler(handle.db);
  } catch {
    return srsError("database_unavailable", "SRS database unavailable", 503);
  } finally {
    if (handle.close) {
      handle.db.close();
    }
  }
}

function srsError(error: SrsApiErrorCode, message: string, status: number) {
  return json({ error, message } satisfies SrsApiErrorResponse, { status });
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
    srs: toKanjiSrsStatusResponse(db, kanji.literal, new Date().toISOString()),
    mnemonics: [],
    words: getWordsForKanji(db, kanji.literal),
    relations: [],
  };
}

function toSrsCardSummary(card: DomainSrsCard): SrsCardSummary {
  return {
    id: card.id,
    kanjiLiteral: card.kanjiLiteral,
    cardKind: card.cardKind,
    enabled: card.enabled,
    schedulerVersion: card.schedulerVersion,
    state: card.state,
    dueAt: card.dueAt,
    intervalDays: card.intervalDays,
    easeFactor: card.easeFactor,
    reps: card.reps,
    lapses: card.lapses,
    lastReviewedAt: card.lastReviewedAt,
  };
}

function toKanjiSrsStatusResponse(db: Db, literal: string, now: string): KanjiSrsStatusResponse {
  const cards = getSrsCardsForKanji(db, literal)
    .map(toSrsCardSummary)
    .sort((left, right) => cardKindSort(left.cardKind) - cardKindSort(right.cardKind));

  return {
    enabled: cards.some((card) => card.enabled),
    dueCount: countDueSrsCards(db, now),
    cards,
  };
}

function cardKindSort(cardKind: SrsCardSummary["cardKind"]) {
  return cardKind === "kanji_recognition" ? 0 : 1;
}

function toSrsReviewCardResponse(db: Db, card: DomainSrsCard | null): SrsReviewCardResponse | null {
  if (!card) {
    return null;
  }

  const kanji = getKanjiByLiteral(db, card.kanjiLiteral);

  if (!kanji) {
    return null;
  }

  return {
    ...toSrsCardSummary(card),
    meaning: kanji.primaryMeaning,
    readings: getKanjiReadings(db, kanji.literal).map((reading) => ({
      type: reading.type,
      reading: reading.reading,
      meaning: reading.meaning,
      usefulness: reading.usefulness,
    })),
    words: getWordsForKanji(db, kanji.literal),
  };
}

function toReviewQueueResponse(db: Db, now: string): SrsReviewQueueResponse {
  return {
    dueCount: countDueSrsCards(db, now),
    card: toSrsReviewCardResponse(db, getNextDueSrsCard(db, now)),
    generatedAt: now,
  };
}

function toSrsKanjiMatrixResponse(db: Db, now: string): SrsKanjiMatrixResponse {
  return {
    generatedAt: now,
    items: listSrsKanjiMatrixRows(db, now).map((item) => ({
      kanjiLiteral: item.kanjiLiteral,
      meaning: item.meaning,
      nextDueAt: item.nextDueAt,
      nextDueStatus: labelSrsDueStatus(item.nextDueAt, now),
      recognition: item.recognition ? toSrsCardSummary(item.recognition) : null,
      production: item.production ? toSrsCardSummary(item.production) : null,
      totalReps: item.totalReps,
      totalLapses: item.totalLapses,
    })),
  };
}

function labelSrsDueStatus(dueAt: string | null, now: string): SrsDueStatus {
  if (!dueAt) {
    return "disabled";
  }

  const due = new Date(dueAt);
  const current = new Date(now);

  if (due <= current) {
    return due.toDateString() === current.toDateString() ? "due_now" : "overdue";
  }

  return due.toDateString() === current.toDateString() ? "today" : "future";
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

function toSearchResponse(db: Db, query: string): SearchResponse {
  return {
    query,
    items: searchLibrary(db, query),
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

async function serveKanji(literal: string, options: CreateAppOptions) {
  return withRequestDb(options, "Kanji database unavailable", (db) => {
    const kanji = getKanjiByLiteral(db, literal);

    if (!kanji) {
      return json({ error: "Kanji not found" }, { status: 404 });
    }

    return json(toKanjiDetailResponse(db, kanji));
  });
}

async function serveSrsReviewQueue(options: CreateAppOptions) {
  return withSrsRequestDb(options, (db) =>
    json(toReviewQueueResponse(db, new Date().toISOString())),
  );
}

async function serveSrsKanjiMatrix(options: CreateAppOptions) {
  return withSrsRequestDb(options, (db) =>
    json(toSrsKanjiMatrixResponse(db, new Date().toISOString())),
  );
}

async function parseJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await request.json();

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function serveSrsReviewSubmit(request: Request, options: CreateAppOptions) {
  const body = await parseJsonObject(request);
  const cardId = body?.cardId;
  const rating = body?.rating;

  if (typeof cardId !== "string" || typeof rating !== "string" || !reviewRatings.has(rating as SrsReviewRating)) {
    return srsError("invalid_request", "Expected cardId and rating again/hard/good/easy", 400);
  }

  return withWriteRequestDb(options, (db) => {
    const reviewedAt = new Date().toISOString();

    try {
      const result = reviewSrsCard(db, {
        cardId,
        rating: rating as SrsReviewRating,
        reviewedAt,
      });
      const queue = toReviewQueueResponse(db, reviewedAt);

      return json({
        dueCount: queue.dueCount,
        reviewedCardId: result.review.cardId,
        nextCard: queue.card,
      } satisfies SrsReviewSubmitResponse);
    } catch (error) {
      if (error instanceof SrsReviewError) {
        if (error.code === "card_not_found") {
          return srsError("srs_card_not_found", error.message, 404);
        }

        if (error.code === "card_disabled") {
          return srsError("srs_card_disabled", error.message, 409);
        }

        if (error.code === "unknown_scheduler") {
          return srsError("unknown_scheduler", error.message, 409);
        }
      }

      throw error;
    }
  });
}

async function serveKanjiSrsToggle(literal: string, request: Request, options: CreateAppOptions) {
  const body = await parseJsonObject(request);

  if (typeof body?.enabled !== "boolean") {
    return srsError("invalid_request", "Expected enabled boolean", 400);
  }

  return withWriteRequestDb(options, (db) => {
    const kanji = getKanjiByLiteral(db, literal);

    if (!kanji) {
      return srsError("kanji_not_found", "Kanji not found", 404);
    }

    const now = new Date().toISOString();

    if (body.enabled) {
      enableKanjiSrs(db, literal, now);
    } else {
      disableKanjiSrs(db, literal, now);
    }

    return json(toKanjiSrsStatusResponse(db, literal, now));
  });
}

async function serveKanjiList(options: CreateAppOptions) {
  return withRequestDb(options, "Kanji database unavailable", (db) => json(toKanjiListResponse(db)));
}

async function serveWordList(options: CreateAppOptions) {
  return withRequestDb(options, "Word database unavailable", (db) => json(toWordListResponse(db)));
}

async function serveWord(id: string, options: CreateAppOptions) {
  return withRequestDb(options, "Word database unavailable", (db) => {
    const word = getWordById(db, id);

    if (!word) {
      return json({ error: "Word not found" }, { status: 404 });
    }

    return json(toWordDetailResponse(word));
  });
}

async function serveSearch(query: string, options: CreateAppOptions) {
  return withRequestDb(options, "Search database unavailable", (db) => json(toSearchResponse(db, query)));
}

async function serveMedia(id: string, options: CreateAppOptions) {
  return withRequestDb(options, "Media database unavailable", async (db) => {
    const media = getMediaAssetById(db, id);

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
  });
}

async function serveStaticRequest(request: Request, pathname: string) {
  try {
    return await serveStaticAsset(pathname);
  } catch {
    if (!isNavigationRequest(request, pathname)) {
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
}

function registerGet(app: Hono, path: string, handler: Handler) {
  app.get(path, handler);
  app.all(path, () => methodNotAllowed());
}

function registerPost(app: Hono, path: string, handler: Handler) {
  app.post(path, handler);
  app.all(path, () => methodNotAllowed(postMethods));
}

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono();

  registerGet(app, "/api/search", (context) => serveSearch(context.req.query("q") ?? "", options));
  registerGet(app, "/api/srs/review", () => serveSrsReviewQueue(options));
  registerGet(app, "/api/srs/cards/matrix", () => serveSrsKanjiMatrix(options));
  registerPost(app, "/api/srs/reviews", (context) => serveSrsReviewSubmit(context.req.raw, options));
  registerGet(app, "/api/kanji", () => serveKanjiList(options));
  registerGet(app, "/api/kanji/:literal", (context) => serveKanji(context.req.param("literal") ?? "", options));
  registerPost(app, "/api/kanji/:literal/srs", (context) =>
    serveKanjiSrsToggle(context.req.param("literal") ?? "", context.req.raw, options),
  );
  registerGet(app, "/api/words", () => serveWordList(options));
  registerGet(app, "/api/words/:id", (context) => serveWord(context.req.param("id") ?? "", options));
  registerGet(app, "/api/media/:id", (context) => serveMedia(context.req.param("id") ?? "", options));
  registerGet(app, "/api/health", () => json({ ok: true }));
  registerGet(app, "/api/home", () => json(getHomePageData()));

  app.all("/api/*", () => json({ error: "Not found" }, { status: 404 }));
  registerGet(app, "*", (context) => serveStaticRequest(context.req.raw, context.req.path));

  return async function handle(request: Request): Promise<Response> {
    return app.fetch(request);
  };
}
