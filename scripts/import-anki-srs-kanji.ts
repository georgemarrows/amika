import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import DatabaseConstructor from "better-sqlite3";
import type { Database as SqliteDatabase } from "better-sqlite3";

import {
  defaultDatabasePath,
  insertKanjiStubIfMissing,
  openDatabase,
  runMigrations,
  upsertImportedSrsCard,
  upsertSrsImportLink,
  type Db,
} from "../server/src/db/index.js";
import { buildSrsCardId } from "../server/src/srs/ids.js";
import { simpleSm2SchedulerVersion } from "../server/src/srs/simple-sm2.js";
import type { SrsCard, SrsCardKind, SrsCardState } from "../server/src/srs/types.js";
import { backupSqliteDatabase } from "./sqlite-backup.js";

const fieldSeparator = "\x1f";
const defaultCollectionPath = "/Users/georgem/Library/Application Support/Anki2/User 1/collection.anki2";
const defaultDeckName = `_Work${fieldSeparator}KLC`;
const defaultEaseFactor = 2.5;

type AnkiDeckRow = {
  id: number | string;
  name: string;
};

type AnkiCardRow = {
  id: number;
  nid: number;
  did: number;
  ord: number;
  type: number;
  queue: number;
  due: number;
  ivl: number;
  factor: number;
  reps: number;
  lapses: number;
  left: number;
  odue: number;
  odid: number;
  mid: number;
  flds: string;
};

type AnkiFieldRow = {
  ntid: number;
  ord: number;
  name: string;
};

type AnkiTemplateRow = {
  ntid: number;
  ord: number;
  name: string;
};

type AnkiRawState = Pick<AnkiCardRow, "type" | "queue" | "due" | "ivl" | "factor" | "reps" | "lapses" | "left" | "odue" | "odid">;

type ImportableAnkiCard = {
  sourceCardId: string;
  sourceNoteId: string;
  sourceDeckId: string;
  sourceDeckName: string;
  sourceCardOrd: number;
  sourceNotetypeId: string;
  sourceTemplateName: string;
  kanjiLiteral: string;
  kanjiMeaning: string;
  cardKind: SrsCardKind;
  cardState: Omit<SrsCard, "createdAt" | "updatedAt">;
  raw: AnkiRawState;
};

export type ImportAnkiSrsKanjiOptions = {
  collectionPath?: string;
  deckName?: string;
  dbPath?: string;
  apply?: boolean;
  now?: string;
  backupDir?: string;
};

export type SkippedAnkiSrsKanjiCard = {
  sourceCardId: string;
  sourceNoteId: string;
  sourceCardOrd: number;
  reason: "non_kanji_damage" | "unsupported_template" | "unsupported_queue";
};

export type ProposedAnkiSrsKanjiCard = {
  sourceCardId: string;
  sourceNoteId: string;
  sourceCardOrd: number;
  sourceTemplateName: string;
  kanjiLiteral: string;
  cardKind: SrsCardKind;
  enabled: boolean;
  state: SrsCardState;
  dueAt: string;
  intervalDays: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  raw: AnkiRawState;
};

export type ImportAnkiSrsKanjiSummary = {
  mode: "dry-run" | "apply";
  collectionPath: string;
  dbPath: string;
  backupPath: string | null;
  deck: {
    id: string;
    name: string;
    displayName: string;
  };
  ankiCounts: {
    total: number;
    new: number;
    learning: number;
    review: number;
    suspended: number;
    skipped: number;
  };
  proposedCount: number;
  importedCount: number;
  skippedCards: SkippedAnkiSrsKanjiCard[];
  proposedCards: ProposedAnkiSrsKanjiCard[];
};

function sha256Text(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildSrsImportLinkId(card: ImportableAnkiCard, collectionPath: string) {
  return `srs-import-${sha256Text(
    [
      "anki",
      collectionPath,
      card.sourceDeckId,
      card.sourceNoteId,
      card.sourceCardId,
    ].join(fieldSeparator),
  ).slice(0, 16)}`;
}

function normalizeDeckName(name: string) {
  return name.includes(" / ") ? name.replaceAll(" / ", fieldSeparator) : name;
}

function displayDeckName(name: string) {
  return name.replaceAll(fieldSeparator, " / ");
}

function assertInactiveCollection(collectionPath: string) {
  const walPath = `${collectionPath}-wal`;

  if (existsSync(walPath)) {
    throw new Error(`Refusing to import from active Anki profile; close Anki first and remove WAL: ${walPath}`);
  }
}

function readDeck(ankiDb: SqliteDatabase, deckName: string): AnkiDeckRow {
  const normalizedDeckName = normalizeDeckName(deckName);
  const deck = ankiDb
    .prepare("select id, name from decks where name = ?")
    .get(normalizedDeckName) as AnkiDeckRow | undefined;

  if (!deck) {
    throw new Error(`Anki deck not found: ${displayDeckName(normalizedDeckName)}`);
  }

  return deck;
}

function readCollectionCreatedAt(ankiDb: SqliteDatabase) {
  const row = ankiDb.prepare("select crt from col limit 1").get() as { crt: number } | undefined;

  if (!row) {
    throw new Error("Anki collection metadata not found: col.crt");
  }

  return row.crt;
}

function readFieldsByNotetype(ankiDb: SqliteDatabase) {
  const rows = ankiDb
    .prepare("select ntid, ord, name from fields order by ntid, ord")
    .all() as AnkiFieldRow[];
  const byNotetype = new Map<number, AnkiFieldRow[]>();

  for (const row of rows) {
    const fields = byNotetype.get(row.ntid) ?? [];
    fields.push(row);
    byNotetype.set(row.ntid, fields);
  }

  return byNotetype;
}

function readTemplatesByNotetype(ankiDb: SqliteDatabase) {
  const rows = ankiDb
    .prepare("select ntid, ord, name from templates order by ntid, ord")
    .all() as AnkiTemplateRow[];
  const byNotetype = new Map<number, Map<number, AnkiTemplateRow>>();

  for (const row of rows) {
    const templates = byNotetype.get(row.ntid) ?? new Map<number, AnkiTemplateRow>();
    templates.set(row.ord, row);
    byNotetype.set(row.ntid, templates);
  }

  return byNotetype;
}

function readCardsForDeck(ankiDb: SqliteDatabase, deckId: string) {
  return ankiDb
    .prepare(
      `
      select
        cards.id,
        cards.nid,
        cards.did,
        cards.ord,
        cards.type,
        cards.queue,
        cards.due,
        cards.ivl,
        cards.factor,
        cards.reps,
        cards.lapses,
        cards.left,
        cards.odue,
        cards.odid,
        notes.mid,
        notes.flds
      from cards
      join notes on notes.id = cards.nid
      where cards.did = ?
      order by cards.id
      `,
    )
    .all(deckId) as AnkiCardRow[];
}

function mapAnkiFields(fieldRows: AnkiFieldRow[], flds: string) {
  const values = flds.split(fieldSeparator);
  const fields = new Map<string, string>();

  for (const field of fieldRows) {
    fields.set(field.name, values[field.ord] ?? "");
  }

  return fields;
}

function mapTemplateToCardKind(template: AnkiTemplateRow | undefined): SrsCardKind | null {
  if (!template) {
    return null;
  }

  if (template.ord === 0 && template.name === "Write") {
    return "kanji_production";
  }

  if (template.ord === 1 && template.name === "Read") {
    return "kanji_recognition";
  }

  return null;
}

function dueAtFromUnixSeconds(seconds: number) {
  return new Date(seconds * 1000).toISOString();
}

function dueAtFromCollectionDay(collectionCreatedAtSeconds: number, day: number) {
  return dueAtFromUnixSeconds(collectionCreatedAtSeconds + day * 24 * 60 * 60);
}

function stateFromAnki(card: AnkiCardRow): SrsCardState {
  if (card.queue === 1 || card.type === 1) {
    return "learning";
  }

  if (card.type === 3) {
    return "relearning";
  }

  if (card.queue === 2 || card.type === 2) {
    return "review";
  }

  return "new";
}

function dueAtFromAnki(card: AnkiCardRow, collectionCreatedAtSeconds: number, now: string) {
  const state = stateFromAnki(card);

  if (state === "learning" || state === "relearning") {
    return dueAtFromUnixSeconds(card.due);
  }

  if (state === "review") {
    return dueAtFromCollectionDay(collectionCreatedAtSeconds, card.due);
  }

  return now;
}

function easeFactorFromAnki(factor: number) {
  return factor === 0 ? defaultEaseFactor : factor / 1000;
}

function rawState(card: AnkiCardRow): AnkiRawState {
  return {
    type: card.type,
    queue: card.queue,
    due: card.due,
    ivl: card.ivl,
    factor: card.factor,
    reps: card.reps,
    lapses: card.lapses,
    left: card.left,
    odue: card.odue,
    odid: card.odid,
  };
}

function skippedCard(card: AnkiCardRow, reason: SkippedAnkiSrsKanjiCard["reason"]): SkippedAnkiSrsKanjiCard {
  return {
    sourceCardId: String(card.id),
    sourceNoteId: String(card.nid),
    sourceCardOrd: card.ord,
    reason,
  };
}

function isImportableQueue(queue: number) {
  return queue === -1 || queue === 0 || queue === 1 || queue === 2;
}

function collectImportableCards(params: {
  ankiCards: AnkiCardRow[];
  fieldsByNotetype: Map<number, AnkiFieldRow[]>;
  templatesByNotetype: Map<number, Map<number, AnkiTemplateRow>>;
  deck: AnkiDeckRow;
  collectionCreatedAtSeconds: number;
  now: string;
}) {
  const importable: ImportableAnkiCard[] = [];
  const skipped: SkippedAnkiSrsKanjiCard[] = [];

  for (const card of params.ankiCards) {
    if (!isImportableQueue(card.queue)) {
      skipped.push(skippedCard(card, "unsupported_queue"));
      continue;
    }

    const fieldRows = params.fieldsByNotetype.get(card.mid) ?? [];
    const fields = mapAnkiFields(fieldRows, card.flds);
    const kanjiLiteral = fields.get("Kanji")?.trim() ?? "";
    const kanjiMeaning = fields.get("Meaning")?.trim() || "Imported from Anki";

    if (!kanjiLiteral) {
      skipped.push(skippedCard(card, "non_kanji_damage"));
      continue;
    }

    const template = params.templatesByNotetype.get(card.mid)?.get(card.ord);
    const cardKind = mapTemplateToCardKind(template);

    if (!cardKind) {
      skipped.push(skippedCard(card, "unsupported_template"));
      continue;
    }

    const enabled = card.queue !== -1;
    const state = stateFromAnki(card);
    const cardState: Omit<SrsCard, "createdAt" | "updatedAt"> = {
      id: buildSrsCardId(kanjiLiteral, cardKind),
      kanjiLiteral,
      cardKind,
      enabled,
      schedulerVersion: simpleSm2SchedulerVersion,
      state,
      dueAt: dueAtFromAnki(card, params.collectionCreatedAtSeconds, params.now),
      intervalDays: Math.max(0, card.ivl),
      easeFactor: easeFactorFromAnki(card.factor),
      reps: card.reps,
      lapses: card.lapses,
      lastReviewedAt: null,
    };

    importable.push({
      sourceCardId: String(card.id),
      sourceNoteId: String(card.nid),
      sourceDeckId: String(params.deck.id),
      sourceDeckName: params.deck.name,
      sourceCardOrd: card.ord,
      sourceNotetypeId: String(card.mid),
      sourceTemplateName: template?.name ?? "",
      kanjiLiteral,
      kanjiMeaning,
      cardKind,
      cardState,
      raw: rawState(card),
    });
  }

  return { importable, skipped };
}

function countCards(cards: AnkiCardRow[], skippedCount: number): ImportAnkiSrsKanjiSummary["ankiCounts"] {
  return {
    total: cards.length,
    new: cards.filter((card) => card.queue === 0 && card.type === 0).length,
    learning: cards.filter((card) => card.queue === 1).length,
    review: cards.filter((card) => card.queue === 2).length,
    suspended: cards.filter((card) => card.queue === -1).length,
    skipped: skippedCount,
  };
}

function toProposedCard(card: ImportableAnkiCard): ProposedAnkiSrsKanjiCard {
  return {
    sourceCardId: card.sourceCardId,
    sourceNoteId: card.sourceNoteId,
    sourceCardOrd: card.sourceCardOrd,
    sourceTemplateName: card.sourceTemplateName,
    kanjiLiteral: card.kanjiLiteral,
    cardKind: card.cardKind,
    enabled: card.cardState.enabled,
    state: card.cardState.state,
    dueAt: card.cardState.dueAt,
    intervalDays: card.cardState.intervalDays,
    easeFactor: card.cardState.easeFactor,
    reps: card.cardState.reps,
    lapses: card.cardState.lapses,
    raw: card.raw,
  };
}

function applyImport(params: {
  appDb: Db;
  cards: ImportableAnkiCard[];
  collectionPath: string;
  now: string;
}) {
  const importCards = params.appDb.transaction(() => {
    for (const card of params.cards) {
      insertKanjiStubIfMissing(params.appDb, {
        literal: card.kanjiLiteral,
        primaryMeaning: card.kanjiMeaning,
        sourceRecordId: null,
        now: params.now,
      });
      upsertImportedSrsCard(params.appDb, {
        ...card.cardState,
        now: params.now,
      });
      upsertSrsImportLink(params.appDb, {
        id: buildSrsImportLinkId(card, params.collectionPath),
        cardId: card.cardState.id,
        source: "anki",
        sourceCollectionPath: params.collectionPath,
        sourceDeckId: card.sourceDeckId,
        sourceDeckName: card.sourceDeckName,
        sourceNoteId: card.sourceNoteId,
        sourceCardId: card.sourceCardId,
        sourceCardOrd: card.sourceCardOrd,
        sourceNotetypeId: card.sourceNotetypeId,
        sourceTemplateName: card.sourceTemplateName,
        importedAt: params.now,
      });
    }

    return params.cards.length;
  });

  return importCards();
}

export async function importAnkiSrsKanji(options: ImportAnkiSrsKanjiOptions = {}): Promise<ImportAnkiSrsKanjiSummary> {
  const collectionPath = resolve(options.collectionPath ?? defaultCollectionPath);
  const dbPath = options.dbPath ?? process.env.AMIKA_DB_PATH ?? defaultDatabasePath;
  const deckName = options.deckName ?? defaultDeckName;
  const now = options.now ?? new Date().toISOString();

  assertInactiveCollection(collectionPath);

  const ankiDb = new DatabaseConstructor(collectionPath, { readonly: true, fileMustExist: true });

  try {
    const deck = readDeck(ankiDb, deckName);
    const collectionCreatedAtSeconds = readCollectionCreatedAt(ankiDb);
    const ankiCards = readCardsForDeck(ankiDb, String(deck.id));
    const { importable, skipped } = collectImportableCards({
      ankiCards,
      fieldsByNotetype: readFieldsByNotetype(ankiDb),
      templatesByNotetype: readTemplatesByNotetype(ankiDb),
      deck,
      collectionCreatedAtSeconds,
      now,
    });
    let backupPath: string | null = null;
    let importedCount = 0;

    if (options.apply) {
      backupPath = await backupSqliteDatabase({
        dbPath,
        now,
        backupDir: options.backupDir,
      });

      const appDb = openDatabase({ path: dbPath });

      try {
        runMigrations(appDb);
        importedCount = applyImport({
          appDb,
          cards: importable,
          collectionPath,
          now,
        });
      } finally {
        appDb.close();
      }
    }

    return {
      mode: options.apply ? "apply" : "dry-run",
      collectionPath,
      dbPath,
      backupPath,
      deck: {
        id: String(deck.id),
        name: deck.name,
        displayName: displayDeckName(deck.name),
      },
      ankiCounts: countCards(ankiCards, skipped.length),
      proposedCount: importable.length,
      importedCount,
      skippedCards: skipped,
      proposedCards: importable.map(toProposedCard),
    };
  } finally {
    ankiDb.close();
  }
}

function parseCliArgs(argv: string[]): ImportAnkiSrsKanjiOptions {
  const options: ImportAnkiSrsKanjiOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];

    if (arg === "--apply") {
      options.apply = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.apply = false;
      continue;
    }

    if (arg === "--collection" && value) {
      options.collectionPath = value;
      index += 1;
      continue;
    }

    if (arg === "--deck" && value) {
      options.deckName = value;
      index += 1;
      continue;
    }

    if (arg === "--db" && value) {
      options.dbPath = value;
      index += 1;
      continue;
    }

    if (arg === "--backup-dir" && value) {
      options.backupDir = value;
      index += 1;
      continue;
    }

    throw new Error(
      "Usage: bun run import:anki-srs-kanji -- [--dry-run] [--apply] [--collection path/to/collection.anki2] [--deck '_Work / KLC'] [--db .var/amika.sqlite]",
    );
  }

  return options;
}

function summarizeList<T>(values: T[]) {
  return {
    count: values.length,
    preview: values.slice(0, 50),
  };
}

function toCliSummary(summary: ImportAnkiSrsKanjiSummary) {
  return {
    ...summary,
    collectionPath: join(dirname(summary.collectionPath), basename(summary.collectionPath)),
    skippedCards: summarizeList(summary.skippedCards),
    proposedCards: summarizeList(summary.proposedCards),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const summary = await importAnkiSrsKanji(parseCliArgs(process.argv.slice(2)));
    console.log(JSON.stringify(toCliSummary(summary), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
