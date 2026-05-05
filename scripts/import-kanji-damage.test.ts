import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getKanjiByLiteral, openDatabase } from "../server/src/db/index.js";
import {
  extractFirstImageSrc,
  findKanjiNote,
  importKanjiDamage,
  mapAnkiFields,
  parseStrokeCount,
} from "./import-kanji-damage.js";

describe("Kanji Damage parser", () => {
  test("maps Anki fields and extracts minimal 具 metadata", () => {
    const fieldNames = [
      "Number",
      "Kanji",
      "Meaning",
      "Stroke order",
      "Usefulness",
      "Full header",
      "Frequency ranking",
    ];
    const flds = [
      "570",
      "具",
      "tool",
      '<img src="e585b7.png" />',
      "★★★★☆",
      "<div>8 strokes</div>",
      "683",
    ].join("\x1f");
    const fields = mapAnkiFields(fieldNames, flds);
    const note = findKanjiNote([{ noteId: "1439130130915", fields }], "具");

    assert.equal(note.fields.Kanji, "具");
    assert.equal(note.fields.Meaning, "tool");
    assert.equal(extractFirstImageSrc(note.fields["Stroke order"]), "e585b7.png");
    assert.equal(parseStrokeCount(note.fields["Full header"]), 8);
  });

  test("matches kanji literals exactly", () => {
    assert.throws(
      () =>
      findKanjiNote(
        [
          { noteId: "1", fields: { Kanji: "具体的" } },
          { noteId: "2", fields: { Kanji: "目" } },
        ],
        "具",
      ),
      /Kanji Damage note not found/,
    );
  });
});

describe("Kanji Damage importer", () => {
  test("imports 具 from the local APKG when available", async () => {
    const apkgPath = join(process.cwd(), "Official_KanjiDamage_deck_REORDERED.apkg");

    if (!existsSync(apkgPath)) {
      console.warn("Skipping APKG integration test; Official_KanjiDamage_deck_REORDERED.apkg is absent.");
      return;
    }

    const tempDir = mkdtempSync(join(tmpdir(), "amika-import-test-"));
    const dbPath = join(tempDir, "amika.sqlite");
    const mediaRoot = join(tempDir, "media");

    try {
      const first = await importKanjiDamage({
        apkgPath,
        dbPath,
        mediaRoot,
        literal: "具",
        now: "2026-05-05T00:00:00.000Z",
      });
      const second = await importKanjiDamage({
        apkgPath,
        dbPath,
        mediaRoot,
        literal: "具",
        now: "2026-05-05T00:00:00.000Z",
      });
      const db = openDatabase({ path: dbPath, readonly: true, fileMustExist: true });

      try {
        const kanji = getKanjiByLiteral(db, "具");
        const kanjiCount = db.prepare("select count(*) as count from kanji").get() as { count: number };
        const mediaCount = db.prepare("select count(*) as count from media_assets").get() as {
          count: number;
        };

        assert.deepEqual(first.importedLiterals, ["具"]);
        assert.equal(first.mediaCopied, 1);
        assert.equal(second.mediaReused, 1);
        assert.equal(kanji?.primaryMeaning, "tool");
        assert.equal(kanji?.strokeCount, 8);
        assert.equal(kanji?.frequencyRank, 683);
        assert.equal(kanji?.usefulness, "★★★★☆");
        assert.equal(kanji?.strokeOrderMedia?.fileName, "e585b7.png");
        assert.equal(kanjiCount.count, 1);
        assert.equal(mediaCount.count, 1);
      } finally {
        db.close();
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
