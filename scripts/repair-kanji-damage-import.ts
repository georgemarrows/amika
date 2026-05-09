import { pathToFileURL } from "node:url";

import { defaultDatabasePath, openDatabase, type Db } from "../server/src/db/index.js";
import { isImportableWordExpression } from "./import-kanji-damage.js";
import { backupSqliteDatabase } from "./sqlite-backup.js";

export type RepairKanjiDamageImportOptions = {
  dbPath?: string;
  apply?: boolean;
  now?: string;
  backupDir?: string;
};

export type RepairKanjiDamageImportCandidate = {
  id: string;
  expression: string;
  reading: string | null;
  meaning: string | null;
};

export type RepairKanjiDamageImportSummary = {
  mode: "dry-run" | "apply";
  dbPath: string;
  backupPath: string | null;
  candidateCount: number;
  deletedCount: number;
  candidates: RepairKanjiDamageImportCandidate[];
};

const importerWordIdPattern = /^word-[0-9a-f]{16}$/;

export async function repairKanjiDamageImport(
  options: RepairKanjiDamageImportOptions = {},
): Promise<RepairKanjiDamageImportSummary> {
  const dbPath = options.dbPath ?? process.env.AMIKA_DB_PATH ?? defaultDatabasePath;
  const db = openDatabase({ path: dbPath, readonly: true, fileMustExist: true });

  try {
    const candidates = findInvalidImportedWords(db);
    let backupPath: string | null = null;
    let deletedCount = 0;

    if (options.apply && candidates.length > 0) {
      db.close();
      backupPath = await backupSqliteDatabase({
        dbPath,
        now: options.now,
        backupDir: options.backupDir,
      });

      const writeDb = openDatabase({ path: dbPath });

      try {
        deletedCount = deleteInvalidImportedWords(writeDb, candidates.map((candidate) => candidate.id));
      } finally {
        writeDb.close();
      }
    }

    return {
      mode: options.apply ? "apply" : "dry-run",
      dbPath,
      backupPath,
      candidateCount: candidates.length,
      deletedCount,
      candidates,
    };
  } finally {
    if (db.open) {
      db.close();
    }
  }
}

function findInvalidImportedWords(db: Db): RepairKanjiDamageImportCandidate[] {
  return (
    db
      .prepare(
        `
        select
          id,
          expression,
          reading,
          primary_meaning
        from words
        order by expression, reading
        `,
      )
      .all() as Array<{
      id: string;
      expression: string;
      reading: string | null;
      primary_meaning: string | null;
    }>
  )
    .filter((word) => importerWordIdPattern.test(word.id) && !isImportableWordExpression(word.expression))
    .map((word) => ({
      id: word.id,
      expression: word.expression,
      reading: word.reading,
      meaning: word.primary_meaning,
    }));
}

function deleteInvalidImportedWords(db: Db, wordIds: string[]) {
  const removeMeanings = db.prepare("delete from word_meanings where word_id = ?");
  const removeKanjiLinks = db.prepare("delete from word_kanji where word_id = ?");
  const removeWord = db.prepare("delete from words where id = ?");
  const removeWords = db.transaction(() => {
    let deletedCount = 0;

    for (const wordId of wordIds) {
      removeMeanings.run(wordId);
      removeKanjiLinks.run(wordId);
      deletedCount += removeWord.run(wordId).changes;
    }

    return deletedCount;
  });

  return removeWords();
}

function parseCliArgs(argv: string[]): RepairKanjiDamageImportOptions {
  const options: RepairKanjiDamageImportOptions = {};

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

    throw new Error("Usage: bun run repair:kanji-damage-import -- [--dry-run] [--apply] [--db .var/amika.sqlite]");
  }

  return options;
}

function toCliSummary(summary: RepairKanjiDamageImportSummary) {
  return {
    ...summary,
    candidates: {
      count: summary.candidates.length,
      preview: summary.candidates.slice(0, 50),
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const summary = await repairKanjiDamageImport(parseCliArgs(process.argv.slice(2)));
    console.log(JSON.stringify(toCliSummary(summary), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
