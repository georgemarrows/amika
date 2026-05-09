import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  insertKanjiStubIfMissing,
  openDatabase,
  replaceWordKanji,
  runMigrations,
  upsertWord,
  upsertWordMeaning,
} from "../server/src/db/index.js";
import { buildWordId } from "./import-kanji-damage.js";
import { repairKanjiDamageImport } from "./repair-kanji-damage-import.js";

describe("Kanji Damage import repair", () => {
  test("dry-runs and applies invalid imported word cleanup with a backup", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-repair-test-"));
    const dbPath = join(tempDir, "amika.sqlite");
    const backupDir = join(tempDir, "backups");
    const db = openDatabase({ path: dbPath });
    const invalidWordId = buildWordId("1969年", "1969ねん");
    const validWordId = buildWordId("いい加減", "いいかげん");

    try {
      runMigrations(db);
      insertKanjiStubIfMissing(db, {
        literal: "年",
        primaryMeaning: "year",
        sourceRecordId: null,
        now: "2026-05-05T00:00:00.000Z",
      });
      insertKanjiStubIfMissing(db, {
        literal: "加",
        primaryMeaning: "add",
        sourceRecordId: null,
        now: "2026-05-05T00:00:00.000Z",
      });
      upsertWord(db, {
        id: invalidWordId,
        expression: "1969年",
        reading: "1969ねん",
        primaryMeaning: "not a real word entry",
        usefulness: null,
        now: "2026-05-05T00:00:00.000Z",
      });
      upsertWordMeaning(db, {
        id: `${invalidWordId}-meaning`,
        wordId: invalidWordId,
        meaning: "not a real word entry",
        position: 0,
      });
      replaceWordKanji(db, invalidWordId, [{ wordId: invalidWordId, kanjiLiteral: "年", position: 0 }]);
      upsertWord(db, {
        id: validWordId,
        expression: "いい加減",
        reading: "いいかげん",
        primaryMeaning: "unfounded, pointless",
        usefulness: null,
        now: "2026-05-05T00:00:00.000Z",
      });
      replaceWordKanji(db, validWordId, [{ wordId: validWordId, kanjiLiteral: "加", position: 0 }]);
      db.close();

      const dryRun = await repairKanjiDamageImport({ dbPath, backupDir });

      assert.equal(dryRun.mode, "dry-run");
      assert.equal(dryRun.backupPath, null);
      assert.equal(dryRun.candidateCount, 1);
      assert.equal(dryRun.deletedCount, 0);
      assert.equal(dryRun.candidates[0].expression, "1969年");

      const apply = await repairKanjiDamageImport({
        dbPath,
        backupDir,
        apply: true,
        now: "2026-05-05T00:00:00.000Z",
      });
      const repairedDb = openDatabase({ path: dbPath, readonly: true, fileMustExist: true });

      try {
        assert.equal(apply.mode, "apply");
        assert.equal(apply.candidateCount, 1);
        assert.equal(apply.deletedCount, 1);
        assert.ok(apply.backupPath);
        assert.equal(existsSync(apply.backupPath), true);
        assert.equal(countRows(repairedDb, "words", "id", invalidWordId), 0);
        assert.equal(countRows(repairedDb, "word_meanings", "word_id", invalidWordId), 0);
        assert.equal(countRows(repairedDb, "word_kanji", "word_id", invalidWordId), 0);
        assert.equal(countRows(repairedDb, "words", "id", validWordId), 1);
      } finally {
        repairedDb.close();
      }
    } finally {
      if (db.open) {
        db.close();
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

function countRows(db: ReturnType<typeof openDatabase>, table: string, column: string, value: string) {
  const row = db.prepare(`select count(*) as count from ${table} where ${column} = ?`).get(value) as { count: number };

  return row.count;
}
