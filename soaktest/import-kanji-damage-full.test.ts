import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { openDatabase } from "../server/src/db/index.js";
import { importKanjiDamage } from "../scripts/import-kanji-damage.js";

describe("Kanji Damage full-deck import soak test", () => {
  test("imports the full deck idempotently when the local APKG is available", async () => {
    const apkgPath = join(process.cwd(), "Official_KanjiDamage_deck_REORDERED.apkg");

    if (!existsSync(apkgPath)) {
      console.warn("Skipping full-deck soak test; Official_KanjiDamage_deck_REORDERED.apkg is absent.");
      return;
    }

    const tempDir = mkdtempSync(join(tmpdir(), "amika-full-import-test-"));
    const dbPath = join(tempDir, "amika.sqlite");
    const mediaRoot = join(tempDir, "media");

    try {
      const first = await importKanjiDamage({
        apkgPath,
        dbPath,
        mediaRoot,
        now: "2026-05-05T00:00:00.000Z",
      });
      const db = openDatabase({ path: dbPath, readonly: true, fileMustExist: true });

      let firstCounts: Record<string, number>;

      try {
        firstCounts = countImportedRows(db);
      } finally {
        db.close();
      }

      const second = await importKanjiDamage({
        apkgPath,
        dbPath,
        mediaRoot,
        now: "2026-05-05T00:00:00.000Z",
      });
      const reopenedDb = openDatabase({ path: dbPath, readonly: true, fileMustExist: true });

      try {
        assert.equal(first.importedKanjiCount, 1629);
        assert.equal(first.skippedNoteCount, 128);
        assert.ok(first.importedWordCount > 1000);
        assert.ok(first.importedReadingCount > 1400);
        assert.ok(first.mediaCopied > 1600);
        assert.equal(second.importedKanjiCount, first.importedKanjiCount);
        assert.equal(second.importedWordCount, first.importedWordCount);
        assert.equal(second.mediaCopied, 0);
        assert.equal(second.mediaReused, first.mediaCopied);
        assert.deepEqual(countImportedRows(reopenedDb), firstCounts);
      } finally {
        reopenedDb.close();
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

function countImportedRows(db: ReturnType<typeof openDatabase>) {
  const counts = db
    .prepare(
      `
      select 'kanji' as name, count(*) as count from kanji
      union all select 'words', count(*) from words
      union all select 'word_meanings', count(*) from word_meanings
      union all select 'word_kanji', count(*) from word_kanji
      union all select 'kanji_readings', count(*) from kanji_readings
      union all select 'media_assets', count(*) from media_assets
      `,
    )
    .all() as Array<{ name: string; count: number }>;

  return Object.fromEntries(counts.map((row) => [row.name, row.count]));
}
