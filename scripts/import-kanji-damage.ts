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
  replaceKanjiReadings,
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
import type { KanjiReading } from "../shared/kanji-reading.js";

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
  importedKanjiCount: number;
  importedWordCount: number;
  importedReadingCount: number;
  skippedNoteCount: number;
  notesWithoutReadings: string[];
  notesWithoutWords: string[];
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

export type ParsedKanjiDamageReading = KanjiReading;

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

function buildKanjiReadingId(sourceRecordId: string, reading: ParsedKanjiDamageReading, position: number) {
  return `${sourceRecordId}-reading-${sha256Text(
    `${reading.type}${fieldSeparator}${reading.reading}${fieldSeparator}${reading.meaning ?? ""}${fieldSeparator}${position}`,
  ).slice(0, 16)}`;
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

export function isImportableKanjiLiteral(value: string) {
  const literal = stripHtml(value);

  return [...literal].length === 1 && /\p{Script=Han}/u.test(literal);
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

function splitReadingList(value: string) {
  return stripHtml(value)
    .split(/[,\u3001]/)
    .map((reading) => reading.trim())
    .filter(Boolean);
}

function parseTableRows(html: string) {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
}

function parseFirstCellText(rowHtml: string) {
  return stripHtml(rowHtml.match(/<td\b[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "");
}

function parseSecondCellHtml(rowHtml: string) {
  const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];

  return cells[1]?.[1] ?? "";
}

function parseUsefulnessStars(html: string) {
  return stripHtml(
    html.match(/<span\b[^>]*class=["'][^"']*\busefulness-stars\b[^"']*["'][^>]*>([^<]*)<\/span>/i)?.[1] ?? "",
  ) || null;
}

function parseKunMeaning(cellHtml: string) {
  const beforeStars = cellHtml.split(/<span\b[^>]*class=["'][^"']*\busefulness-stars\b/i)[0] ?? cellHtml;

  return stripHtml(beforeStars) || null;
}

function dedupeReadings(readings: ParsedKanjiDamageReading[]) {
  const seen = new Set<string>();
  const unique: ParsedKanjiDamageReading[] = [];

  for (const reading of readings) {
    const key = `${reading.type}${fieldSeparator}${reading.reading}${fieldSeparator}${reading.meaning ?? ""}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(reading);
    }
  }

  return unique;
}

function parseOnReadings(fields: KanjiDamageFields): ParsedKanjiDamageReading[] {
  const fullRows = parseTableRows(fields["Full onyomi"] ?? "");
  const readings = fullRows.flatMap((row) => splitReadingList(parseFirstCellText(row)));
  const fallbackReadings = readings.length > 0 ? readings : splitReadingList(fields.Onyomi ?? "");

  return fallbackReadings.map((reading) => ({
    type: "on",
    reading,
    meaning: null,
    usefulness: null,
  }));
}

function parseKunReadings(fields: KanjiDamageFields): ParsedKanjiDamageReading[] {
  const fullRows = parseTableRows(fields["Full kunyomi"] ?? "");
  const fullReadings: ParsedKanjiDamageReading[] = [];

  for (const row of fullRows) {
    const reading = parseFirstCellText(row);
    const meaningHtml = parseSecondCellHtml(row);

    if (!reading) {
      continue;
    }

    fullReadings.push({
      type: "kun",
      reading,
      meaning: parseKunMeaning(meaningHtml),
      usefulness: parseUsefulnessStars(meaningHtml),
    });
  }

  if (fullReadings.length > 0) {
    return fullReadings;
  }

  const firstKunyomi = stripHtml(fields["First kunyomi"] ?? "");

  if (!firstKunyomi) {
    return [];
  }

  return [
    {
      type: "kun",
      reading: firstKunyomi,
      meaning: stripHtml(fields["First kunyomi meaning"] ?? "") || null,
      usefulness: stripHtml(fields["First kunyomi usefulness"] ?? "") || null,
    },
  ];
}

export function parseKanjiDamageReadings(fields: KanjiDamageFields): ParsedKanjiDamageReading[] {
  return dedupeReadings([...parseOnReadings(fields), ...parseKunReadings(fields)]);
}

function parseWordComponents(rowHtml: string) {
  const components: ParsedKanjiDamageWord["kanji"] = [];
  const componentPattern = /<a\b[^>]*class=["'][^"']*\bcomponent\b[^"']*["'][^>]*>([^<]+)<\/a>\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;

  while ((match = componentPattern.exec(rowHtml)) !== null) {
    const literal = stripHtml(match[1]);

    if (!isImportableKanjiLiteral(literal)) {
      continue;
    }

    components.push({
      literal,
      meaning: stripHtml(match[2]) || null,
    });
  }

  return components;
}

function extractKanjiComponentsFromExpression(expression: string) {
  return uniq([...expression].filter((literal) => isImportableKanjiLiteral(literal))).map((literal) => ({
    literal,
    meaning: null,
  }));
}

function mergeWordComponents(expression: string, parsedComponents: ParsedKanjiDamageWord["kanji"]) {
  const parsedByLiteral = new Map(parsedComponents.map((component) => [component.literal, component]));

  return extractKanjiComponentsFromExpression(expression).map(
    (component) => parsedByLiteral.get(component.literal) ?? component,
  );
}

export function isImportableWordExpression(expression: string) {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(expression) && !/[A-Za-z0-9０-９]/.test(expression);
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

  if (!isImportableWordExpression(expression)) {
    return null;
  }

  const components = parseWordComponents(rowHtml);

  return {
    id: buildWordId(expression, reading),
    expression,
    reading,
    primaryMeaning,
    usefulness,
    meanings,
    kanji: mergeWordComponents(expression, components),
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

  if (!isImportableWordExpression(expression)) {
    return [];
  }

  return [
    {
      id: buildWordId(expression, reading),
      expression,
      reading,
      primaryMeaning,
      usefulness,
      meanings: primaryMeaning ? [primaryMeaning] : [],
      kanji: extractKanjiComponentsFromExpression(expression),
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

function importReadingRecords(params: {
  appDb: Db;
  kanjiLiteral: string;
  readings: ParsedKanjiDamageReading[];
  sourceRecordId: string;
}) {
  replaceKanjiReadings(
    params.appDb,
    params.kanjiLiteral,
    params.sourceRecordId,
    params.readings.map((reading, index) => ({
      id: buildKanjiReadingId(params.sourceRecordId, reading, index),
      kanjiLiteral: params.kanjiLiteral,
      readingType: reading.type,
      reading: reading.reading,
      meaning: reading.meaning,
      usefulness: reading.usefulness,
      position: index,
      sourceRecordId: params.sourceRecordId,
    })),
  );
}

export async function importKanjiDamage(
  options: ImportKanjiDamageOptions,
): Promise<ImportKanjiDamageSummary> {
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

    const notes = readKanjiDamageNotes(ankiDb);
    const notesToImport = options.literal
      ? [findKanjiNote(notes, options.literal)]
      : notes.filter((note) => isImportableKanjiLiteral(note.fields.Kanji));
    const skippedNoteCount = options.literal ? 0 : notes.length - notesToImport.length;
    const importedLiterals: string[] = [];
    const importedWords: string[] = [];
    const importedWordIds = new Set<string>();
    const notesWithoutReadings: string[] = [];
    const notesWithoutWords: string[] = [];
    let importedReadingCount = 0;
    let mediaCopied = 0;
    let mediaReused = 0;

    upsertSourceDeck(appDb, {
      id: deckId,
      name: "Official KanjiDamage deck REORDERED",
      format: "apkg",
      fileName: basename(options.apkgPath),
      fileHash: deckHash,
      importedAt: now,
    });

    for (const note of notesToImport) {
      const sourceRecordId = `${deckId}-note-${note.noteId}`;
      const strokeImageFileName = extractFirstImageSrc(note.fields["Stroke order"] ?? "");
      let mediaAssetId: string | null = null;

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
        mediaCopied += mediaResult.copied ? 1 : 0;
        mediaReused += mediaResult.copied ? 0 : 1;
      }

      const parsedWords = parseKanjiDamageWords(note.fields);
      const parsedReadings = parseKanjiDamageReadings(note.fields);

      if (parsedReadings.length === 0) {
        notesWithoutReadings.push(note.fields.Kanji);
      }

      if (parsedWords.length === 0) {
        notesWithoutWords.push(note.fields.Kanji);
      }

      const importOne = appDb.transaction(() => {
        importKanjiRecord({
          appDb,
          deckId,
          note,
          mediaAssetId,
          now,
        });

        importReadingRecords({
          appDb,
          kanjiLiteral: note.fields.Kanji,
          readings: parsedReadings,
          sourceRecordId,
        });

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

      for (const word of parsedWords) {
        if (!importedWordIds.has(word.id)) {
          importedWordIds.add(word.id);
          importedWords.push(word.expression);
        }
      }

      importedLiterals.push(note.fields.Kanji);
      importedReadingCount += parsedReadings.length;

      const importedKanji = getKanjiByLiteral(appDb, note.fields.Kanji);

      if (!importedKanji) {
        throw new Error(`Import did not create kanji row for ${note.fields.Kanji}`);
      }
    }

    return {
      deckId,
      deckHash,
      dbPath,
      importedLiterals,
      importedWords,
      importedKanjiCount: importedLiterals.length,
      importedWordCount: importedWordIds.size,
      importedReadingCount,
      skippedNoteCount,
      notesWithoutReadings,
      notesWithoutWords,
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

function summarizeList(values: string[]) {
  return {
    count: values.length,
    preview: values.slice(0, 20),
  };
}

function toCliSummary(summary: ImportKanjiDamageSummary) {
  return {
    deckId: summary.deckId,
    deckHash: summary.deckHash,
    dbPath: summary.dbPath,
    importedKanjiCount: summary.importedKanjiCount,
    importedWordCount: summary.importedWordCount,
    importedReadingCount: summary.importedReadingCount,
    skippedNoteCount: summary.skippedNoteCount,
    mediaCopied: summary.mediaCopied,
    mediaReused: summary.mediaReused,
    importedLiterals: summarizeList(summary.importedLiterals),
    importedWords: summarizeList(summary.importedWords),
    notesWithoutReadings: summarizeList(summary.notesWithoutReadings),
    notesWithoutWords: summarizeList(summary.notesWithoutWords),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const summary = await importKanjiDamage(parseCliArgs(process.argv.slice(2)));
    console.log(JSON.stringify(toCliSummary(summary), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
