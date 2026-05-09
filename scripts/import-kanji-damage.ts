import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import DatabaseConstructor from "better-sqlite3";
import JSZip from "jszip";

import {
  defaultDatabasePath,
  getKanjiByLiteral,
  insertKanjiStubIfMissing,
  openDatabase,
  replaceWordKanji,
  runMigrations,
  upsertKanji,
  upsertMediaAsset,
  upsertSourceDeck,
  upsertSourceRecord,
  upsertWord,
  upsertWordMeaning,
} from "../server/src/db/index.js";
import type { Db } from "../server/src/db/index.js";

const fieldSeparator = "\x1f";

type AnkiNoteRow = {
  id: number;
  mid: number;
  flds: string;
};

type AnkiModel = {
  name: string;
  flds: Array<{
    name: string;
    ord: number;
  }>;
};

export type KanjiDamageFields = Record<string, string>;

export type ParsedKanjiDamageNote = {
  noteId: string;
  fields: KanjiDamageFields;
};

export type ImportKanjiDamageOptions = {
  apkgPath: string;
  literal?: string;
  dbPath?: string;
  mediaRoot?: string;
  now?: string;
};

export type ImportKanjiDamageSummary = {
  deckId: string;
  deckHash: string;
  dbPath: string;
  importedLiterals: string[];
  importedWords: string[];
  mediaCopied: number;
  mediaReused: number;
};

export type ParsedKanjiDamageWord = {
  id: string;
  expression: string;
  reading: string | null;
  primaryMeaning: string | null;
  usefulness: string | null;
  meanings: string[];
  kanji: Array<{
    literal: string;
    meaning: string | null;
  }>;
};

type MediaImportResult = {
  mediaAssetId: string;
  copied: boolean;
};

export function splitAnkiFields(flds: string): string[] {
  return flds.split(fieldSeparator);
}

export function mapAnkiFields(fieldNames: string[], flds: string): KanjiDamageFields {
  const values = splitAnkiFields(flds);
  const fields: KanjiDamageFields = {};

  fieldNames.forEach((fieldName, index) => {
    fields[fieldName] = values[index] ?? "";
  });

  return fields;
}

export function extractFirstImageSrc(html: string): string | null {
  return html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] ?? null;
}

export function parseStrokeCount(fullHeader: string): number | null {
  const value = fullHeader.match(/\b(\d+)\s+strokes?\b/i)?.[1];
  return value ? Number(value) : null;
}

export function parseOptionalInteger(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  return Number(trimmed);
}

function sha256(buffer: Buffer | Uint8Array) {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha256Text(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildWordId(expression: string, reading: string | null) {
  return `word-${sha256Text(`${expression}${fieldSeparator}${reading ?? ""}`).slice(0, 16)}`;
}

function buildWordMeaningId(wordId: string, meaning: string) {
  return `${wordId}-meaning-${sha256Text(meaning).slice(0, 16)}`;
}

function getContentType(fileName: string): string | null {
  switch (extname(fileName).toLowerCase()) {
    case ".gif":
      return "image/gif";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    default:
      return null;
  }
}

function buildDeckId(deckHash: string) {
  return `kanji-damage-${deckHash.slice(0, 16)}`;
}

export function findKanjiNote(notes: ParsedKanjiDamageNote[], literal: string): ParsedKanjiDamageNote {
  const note = notes.find((candidate) => candidate.fields.Kanji === literal);

  if (!note) {
    throw new Error(`Kanji Damage note not found for literal: ${literal}`);
  }

  return note;
}

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&rsquo;", "'")
    .replaceAll("&ldquo;", '"')
    .replaceAll("&rdquo;", '"');
}

function stripHtml(html: string) {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function uniq(values: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      unique.push(value);
    }
  }

  return unique;
}

function parseWordComponents(rowHtml: string) {
  const components: ParsedKanjiDamageWord["kanji"] = [];
  const componentPattern = /<a\b[^>]*class=["'][^"']*\bcomponent\b[^"']*["'][^>]*>([^<]+)<\/a>\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;

  while ((match = componentPattern.exec(rowHtml)) !== null) {
    components.push({
      literal: stripHtml(match[1]),
      meaning: stripHtml(match[2]) || null,
    });
  }

  return components;
}

function parseFullJukugoRow(rowHtml: string): ParsedKanjiDamageWord | null {
  const expressionMatch = rowHtml.match(/<ruby>\s*([^<]+?)\s*<rp>\(<\/rp>\s*<rt>([^<]+)<\/rt>/i);

  if (!expressionMatch) {
    return null;
  }

  const expression = stripHtml(expressionMatch[1]);
  const reading = stripHtml(expressionMatch[2]) || null;
  const paragraphMatches = [...rowHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => match[1]);
  const usefulness = stripHtml(
    rowHtml.match(/<span\b[^>]*class=["'][^"']*\busefulness-stars\b[^"']*["'][^>]*>([^<]*)<\/span>/i)?.[1] ?? "",
  ) || null;
  const primaryMeaning = paragraphMatches[0]
    ? stripHtml(paragraphMatches[0].split(/<span\b[^>]*class=["'][^"']*\busefulness-stars\b/i)[0])
    : null;
  const meanings = uniq(
    [
      primaryMeaning,
      ...paragraphMatches.slice(1).map((paragraph) => stripHtml(paragraph)),
    ].filter((meaning): meaning is string => Boolean(meaning)),
  );

  if (!expression) {
    return null;
  }

  return {
    id: buildWordId(expression, reading),
    expression,
    reading,
    primaryMeaning,
    usefulness,
    meanings,
    kanji: parseWordComponents(rowHtml),
  };
}

function parseFirstJukugo(fields: KanjiDamageFields): ParsedKanjiDamageWord[] {
  const firstJukugo = fields["First jukugo"] ?? "";
  const match = firstJukugo.match(/>([^<[>\]]+)\[([^\]]+)\]</);

  if (!match) {
    return [];
  }

  const expression = stripHtml(match[1]);
  const reading = stripHtml(match[2]) || null;
  const primaryMeaning = stripHtml(fields["First jukugo meaning"] ?? "") || null;
  const usefulness = stripHtml(fields["First jukugo usefulness"] ?? "") || null;

  return [
    {
      id: buildWordId(expression, reading),
      expression,
      reading,
      primaryMeaning,
      usefulness,
      meanings: primaryMeaning ? [primaryMeaning] : [],
      kanji: [...expression].map((literal) => ({
        literal,
        meaning: null,
      })),
    },
  ];
}

export function parseKanjiDamageWords(fields: KanjiDamageFields): ParsedKanjiDamageWord[] {
  const fullJukugo = fields["Full jukugo"] ?? "";
  const rows = [...fullJukugo.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => parseFullJukugoRow(match[1]))
    .filter((word): word is ParsedKanjiDamageWord => word !== null);

  return rows.length > 0 ? rows : parseFirstJukugo(fields);
}

async function extractApkg(apkgPath: string) {
  const apkgBytes = await readFile(apkgPath);
  const zip = await JSZip.loadAsync(apkgBytes);
  const collection = zip.file("collection.anki2");
  const media = zip.file("media");

  if (!collection) {
    throw new Error("APKG is missing collection.anki2");
  }

  if (!media) {
    throw new Error("APKG is missing media manifest");
  }

  const tempDir = await mkdtemp(join(tmpdir(), "amika-kanji-damage-"));
  const collectionPath = join(tempDir, "collection.anki2");
  await writeFile(collectionPath, Buffer.from(await collection.async("uint8array")));

  return {
    apkgBytes,
    collectionPath,
    mediaMap: JSON.parse(await media.async("text")) as Record<string, string>,
    tempDir,
    zip,
  };
}

function getKanjiDamageFieldNames(ankiDb: Db): string[] {
  const row = ankiDb.prepare("select models from col limit 1").get() as { models: string } | undefined;

  if (!row) {
    throw new Error("Anki collection has no col row");
  }

  const models = JSON.parse(row.models) as Record<string, AnkiModel>;
  const model = Object.values(models).find((candidate) => candidate.name === "KanjiDamage");

  if (!model) {
    throw new Error("Anki collection has no KanjiDamage note model");
  }

  return [...model.flds].sort((left, right) => left.ord - right.ord).map((field) => field.name);
}

function readKanjiDamageNotes(ankiDb: Db): ParsedKanjiDamageNote[] {
  const fieldNames = getKanjiDamageFieldNames(ankiDb);
  const rows = ankiDb.prepare("select id, mid, flds from notes").all() as AnkiNoteRow[];

  return rows.map((row) => ({
    noteId: String(row.id),
    fields: mapAnkiFields(fieldNames, row.flds),
  }));
}

async function importMediaAsset(params: {
  appDb: Db;
  zip: JSZip;
  mediaMap: Record<string, string>;
  sourceDeckId: string;
  mediaRoot: string;
  originalFileName: string;
}): Promise<MediaImportResult> {
  const sourceMediaKey = Object.entries(params.mediaMap).find(
    ([, fileName]) => fileName === params.originalFileName,
  )?.[0];

  if (!sourceMediaKey) {
    throw new Error(`APKG media manifest does not reference ${params.originalFileName}`);
  }

  const mediaFile = params.zip.file(sourceMediaKey);

  if (!mediaFile) {
    throw new Error(`APKG media file is missing for key ${sourceMediaKey}`);
  }

  const mediaBytes = Buffer.from(await mediaFile.async("uint8array"));
  const fileHash = sha256(mediaBytes);
  const stableFileName = `${fileHash}${extname(params.originalFileName).toLowerCase()}`;
  const storageDir = join(params.mediaRoot, "kanji-damage");
  const absoluteStoragePath = join(storageDir, stableFileName);
  const storagePath = relative(process.cwd(), absoluteStoragePath);
  const existed = existsSync(absoluteStoragePath);

  mkdirSync(storageDir, { recursive: true });

  if (!existed) {
    writeFileSync(absoluteStoragePath, mediaBytes);
  }

  const mediaAssetId = `${params.sourceDeckId}-media-${sourceMediaKey}`;
  upsertMediaAsset(params.appDb, {
    id: mediaAssetId,
    sourceDeckId: params.sourceDeckId,
    sourceMediaKey,
    fileName: params.originalFileName,
    contentType: getContentType(params.originalFileName),
    fileHash,
    storagePath,
  });

  return {
    mediaAssetId,
    copied: !existed,
  };
}

function importKanjiRecord(params: {
  appDb: Db;
  deckId: string;
  note: ParsedKanjiDamageNote;
  mediaAssetId: string | null;
  now: string;
}) {
  const sourceRecordId = `${params.deckId}-note-${params.note.noteId}`;
  const fields = params.note.fields;

  upsertSourceRecord(params.appDb, {
    id: sourceRecordId,
    sourceDeckId: params.deckId,
    externalId: params.note.noteId,
    recordType: "kanji_damage_note",
    rawJson: JSON.stringify(fields),
  });

  upsertKanji(params.appDb, {
    literal: fields.Kanji,
    primaryMeaning: fields.Meaning,
    strokeCount: parseStrokeCount(fields["Full header"] ?? ""),
    strokeOrderMediaId: params.mediaAssetId,
    frequencyRank: parseOptionalInteger(fields["Frequency ranking"] ?? ""),
    usefulness: fields.Usefulness || null,
    sourceRecordId,
    now: params.now,
  });
}

function importWordRecord(params: {
  appDb: Db;
  word: ParsedKanjiDamageWord;
  sourceRecordId: string;
  now: string;
}) {
  upsertWord(params.appDb, {
    id: params.word.id,
    expression: params.word.expression,
    reading: params.word.reading,
    primaryMeaning: params.word.primaryMeaning,
    usefulness: params.word.usefulness,
    now: params.now,
  });

  params.word.meanings.forEach((meaning, index) => {
    upsertWordMeaning(params.appDb, {
      id: buildWordMeaningId(params.word.id, meaning),
      wordId: params.word.id,
      meaning,
      position: index,
    });
  });

  params.word.kanji.forEach((kanji) => {
    insertKanjiStubIfMissing(params.appDb, {
      literal: kanji.literal,
      primaryMeaning: kanji.meaning ?? "Unknown",
      sourceRecordId: params.sourceRecordId,
      now: params.now,
    });
  });

  replaceWordKanji(
    params.appDb,
    params.word.id,
    params.word.kanji.map((kanji, index) => ({
      wordId: params.word.id,
      kanjiLiteral: kanji.literal,
      position: index,
    })),
  );
}

export async function importKanjiDamage(
  options: ImportKanjiDamageOptions,
): Promise<ImportKanjiDamageSummary> {
  const literal = options.literal ?? "具";
  const dbPath = options.dbPath ?? process.env.AMIKA_DB_PATH ?? defaultDatabasePath;
  const mediaRoot = options.mediaRoot ?? join(process.cwd(), ".var", "media");
  const now = options.now ?? new Date().toISOString();
  const extracted = await extractApkg(options.apkgPath);
  const deckHash = sha256(extracted.apkgBytes);
  const deckId = buildDeckId(deckHash);
  const ankiDb = new DatabaseConstructor(extracted.collectionPath, { readonly: true });
  const appDb = openDatabase({ path: dbPath });

  try {
    runMigrations(appDb);

    const note = findKanjiNote(readKanjiDamageNotes(ankiDb), literal);
    let mediaAssetId: string | null = null;
    let mediaCopied = 0;
    let mediaReused = 0;
    const strokeImageFileName = extractFirstImageSrc(note.fields["Stroke order"] ?? "");

    upsertSourceDeck(appDb, {
      id: deckId,
      name: "Official KanjiDamage deck REORDERED",
      format: "apkg",
      fileName: basename(options.apkgPath),
      fileHash: deckHash,
      importedAt: now,
    });

    if (strokeImageFileName) {
      const mediaResult = await importMediaAsset({
        appDb,
        zip: extracted.zip,
        mediaMap: extracted.mediaMap,
        sourceDeckId: deckId,
        mediaRoot,
        originalFileName: strokeImageFileName,
      });
      mediaAssetId = mediaResult.mediaAssetId;
      mediaCopied = mediaResult.copied ? 1 : 0;
      mediaReused = mediaResult.copied ? 0 : 1;
    }

    const parsedWords = parseKanjiDamageWords(note.fields);
    const importOne = appDb.transaction(() => {
      importKanjiRecord({
        appDb,
        deckId,
        note,
        mediaAssetId,
        now,
      });

      const sourceRecordId = `${deckId}-note-${note.noteId}`;
      for (const word of parsedWords) {
        importWordRecord({
          appDb,
          word,
          sourceRecordId,
          now,
        });
      }
    });
    importOne();

    const importedKanji = getKanjiByLiteral(appDb, literal);

    if (!importedKanji) {
      throw new Error(`Import did not create kanji row for ${literal}`);
    }

    return {
      deckId,
      deckHash,
      dbPath,
      importedLiterals: [literal],
      importedWords: parsedWords.map((word) => word.expression),
      mediaCopied,
      mediaReused,
    };
  } finally {
    ankiDb.close();
    appDb.close();
    await rm(extracted.tempDir, { recursive: true, force: true });
  }
}

function parseCliArgs(argv: string[]): ImportKanjiDamageOptions {
  const [apkgPath, ...rest] = argv;

  if (!apkgPath || apkgPath.startsWith("--")) {
    throw new Error("Usage: bun run import:kanji-damage -- <deck.apkg> [--literal 具] [--db .var/amika.sqlite]");
  }

  const options: ImportKanjiDamageOptions = { apkgPath };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const value = rest[index + 1];

    if (arg === "--literal" && value) {
      options.literal = value;
      index += 1;
      continue;
    }

    if (arg === "--db" && value) {
      options.dbPath = value;
      index += 1;
      continue;
    }

    if (arg === "--media-root" && value) {
      options.mediaRoot = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown or incomplete argument: ${arg}`);
  }

  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const summary = await importKanjiDamage(parseCliArgs(process.argv.slice(2)));
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
