import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getKanjiByLiteral, getWordById, getWordsForKanji, openDatabase } from "../server/src/db/index.js";
import {
  extractFirstImageSrc,
  findKanjiNote,
  importKanjiDamage,
  mapAnkiFields,
  parseKanjiDamageWords,
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

  test("parses full jukugo rows into words", () => {
    const words = parseKanjiDamageWords({
      "Full jukugo": `
        <table><tbody><tr>
          <td><ruby><span class="kanji_character"><ruby>道具<rp>(</rp><rt>どうぐ</rt><rp>)</rp></ruby></span></ruby></td>
          <td><p>
            tool
            <span class="usefulness-stars" title="4 out of 5 stars">★★★★☆</span>
            <br/>
            <a class="component" href="http://www.kanjidamage.com/kanji/861-street-%E9%81%93">道</a> (street)
            + <a class="component" href="http://www.kanjidamage.com/kanji/570-tool-%E5%85%B7">具</a> (tool)
            = 道具 (tool)
          </p></td>
        </tr></tbody></table>
      `,
    });

    assert.equal(words.length, 1);
    assert.equal(words[0].expression, "道具");
    assert.equal(words[0].reading, "どうぐ");
    assert.equal(words[0].primaryMeaning, "tool");
    assert.equal(words[0].usefulness, "★★★★☆");
    assert.deepEqual(words[0].meanings, ["tool"]);
    assert.deepEqual(words[0].kanji, [
      { literal: "道", meaning: "street" },
      { literal: "具", meaning: "tool" },
    ]);
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
        const words = getWordsForKanji(db, "具");
        const dogu = words.find((word) => word.expression === "道具");
        const kanjiCount = db.prepare("select count(*) as count from kanji").get() as { count: number };
        const mediaCount = db.prepare("select count(*) as count from media_assets").get() as {
          count: number;
        };
        const wordCount = db.prepare("select count(*) as count from words").get() as { count: number };
        const wordMeaningCount = db.prepare("select count(*) as count from word_meanings").get() as { count: number };
        const wordKanjiCount = db.prepare("select count(*) as count from word_kanji").get() as { count: number };

        assert.deepEqual(first.importedLiterals, ["具"]);
        assert.deepEqual(first.importedWords, ["道具", "家具", "具体的", "具合"]);
        assert.equal(first.mediaCopied, 1);
        assert.equal(second.mediaReused, 1);
        assert.equal(kanji?.primaryMeaning, "tool");
        assert.equal(kanji?.strokeCount, 8);
        assert.equal(kanji?.frequencyRank, 683);
        assert.equal(kanji?.usefulness, "★★★★☆");
        assert.equal(kanji?.strokeOrderMedia?.fileName, "e585b7.png");
        assert.equal(kanjiCount.count, 6);
        assert.equal(mediaCount.count, 1);
        assert.equal(wordCount.count, 4);
        assert.equal(wordMeaningCount.count, 6);
        assert.equal(wordKanjiCount.count, 9);
        assert.deepEqual(
          words.map((word) => word.expression),
          ["道具", "家具", "具体的", "具合"],
        );
        assert.equal(dogu?.reading, "どうぐ");
        assert.deepEqual(getWordById(db, dogu?.id ?? "")?.kanji, [
          { literal: "道", meaning: "street", position: 0 },
          { literal: "具", meaning: "tool", position: 1 },
        ]);
      } finally {
        db.close();
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
