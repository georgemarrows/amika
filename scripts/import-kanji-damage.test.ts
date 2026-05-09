import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getKanjiByLiteral, getKanjiReadings, getWordById, getWordsForKanji, openDatabase } from "../server/src/db/index.js";
import {
  extractFirstImageSrc,
  findKanjiNote,
  importKanjiDamage,
  mapAnkiFields,
  parseKanjiDamageReadings,
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

  test("parses minimal on-only kanji readings", () => {
    const readings = parseKanjiDamageReadings({
      Onyomi: "GU",
      "Full onyomi": `
        <table class="definition"><tbody><tr>
          <td><span class="onyomi">GU</span></td>
          <td></td>
        </tr></tbody></table>
      `,
      "Full kunyomi": "",
    });

    assert.deepEqual(readings, [
      {
        type: "on",
        reading: "GU",
        meaning: null,
        usefulness: null,
      },
    ]);
  });

  test("parses multi-on readings from Kanji Damage fields", () => {
    const readings = parseKanjiDamageReadings({
      Onyomi: "ICHI, ITSU",
      "Full onyomi": `
        <table class="definition"><tbody><tr>
          <td><span class="onyomi">ICHI, ITSU</span></td>
          <td><p>mnemonic text is not imported for T-30000a</p></td>
        </tr></tbody></table>
      `,
      "First kunyomi": '<span class="kanji_character">ひと*つ</span>',
      "First kunyomi meaning": "one thing",
      "First kunyomi usefulness": "★★★★☆",
      "Full kunyomi": `
        <table class="definition"><tbody><tr>
          <td><span class="kanji_character">ひと*つ</span></td>
          <td>one thing<br/><span class="usefulness-stars">★★★★☆</span></td>
        </tr></tbody></table>
      `,
    });

    assert.deepEqual(readings, [
      { type: "on", reading: "ICHI", meaning: null, usefulness: null },
      { type: "on", reading: "ITSU", meaning: null, usefulness: null },
      { type: "kun", reading: "ひと*つ", meaning: "one thing", usefulness: "★★★★☆" },
    ]);
  });

  test("parses rich full kunyomi rows", () => {
    const readings = parseKanjiDamageReadings({
      Onyomi: "KOU",
      "Full onyomi": `
        <table class="definition"><tbody><tr>
          <td><span class="onyomi">KOU</span></td>
          <td></td>
        </tr></tbody></table>
      `,
      "Full kunyomi": `
        <table class="definition"><tbody>
          <tr>
            <td><span class="kanji_character">( が ) す*き</span></td>
            <td>to like<br/><span class="usefulness-stars">★★★★★</span></td>
          </tr>
          <tr>
            <td><span class="kanji_character">この＊む</span></td>
            <td>To have a preference for.<br/><span class="usefulness-stars">★★☆☆☆</span></td>
          </tr>
          <tr>
            <td><span class="kanji_character">この＊み</span></td>
            <td>The noun form of 好む.<br/><span class="usefulness-stars">★☆☆☆☆</span></td>
          </tr>
        </tbody></table>
      `,
    });

    assert.deepEqual(readings, [
      { type: "on", reading: "KOU", meaning: null, usefulness: null },
      { type: "kun", reading: "( が ) す*き", meaning: "to like", usefulness: "★★★★★" },
      { type: "kun", reading: "この＊む", meaning: "To have a preference for.", usefulness: "★★☆☆☆" },
      { type: "kun", reading: "この＊み", meaning: "The noun form of 好む.", usefulness: "★☆☆☆☆" },
    ]);
  });

  test("parses 日 as multi-on plus single-kun metadata", () => {
    const readings = parseKanjiDamageReadings({
      Onyomi: "NICHI, JITSU",
      "Full onyomi": `
        <table class="definition"><tbody><tr>
          <td><span class="onyomi">NICHI, JITSU</span></td>
          <td><p>mnemonic text is not imported.</p></td>
        </tr></tbody></table>
      `,
      "First kunyomi": '<span class="kanji_character">ひ</span>',
      "First kunyomi meaning": "a day",
      "First kunyomi usefulness": "★★★★★",
      "Full kunyomi": `
        <table class="definition"><tbody><tr>
          <td><span class="kanji_character">ひ</span></td>
          <td>a day<br/><span class="usefulness-stars">★★★★★</span></td>
        </tr></tbody></table>
      `,
    });

    assert.deepEqual(readings, [
      { type: "on", reading: "NICHI", meaning: null, usefulness: null },
      { type: "on", reading: "JITSU", meaning: null, usefulness: null },
      { type: "kun", reading: "ひ", meaning: "a day", usefulness: "★★★★★" },
    ]);
  });

  test("falls back to simple reading fields when full tables are absent", () => {
    const readings = parseKanjiDamageReadings({
      Onyomi: "KOU, KU",
      "First kunyomi": '<span class="kanji_character">くち</span>',
      "First kunyomi meaning": "mouth",
      "First kunyomi usefulness": "★★★★★",
    });

    assert.deepEqual(readings, [
      { type: "on", reading: "KOU", meaning: null, usefulness: null },
      { type: "on", reading: "KU", meaning: null, usefulness: null },
      { type: "kun", reading: "くち", meaning: "mouth", usefulness: "★★★★★" },
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
        const readings = getKanjiReadings(db, "具");
        const dogu = words.find((word) => word.expression === "道具");
        const kanjiCount = db.prepare("select count(*) as count from kanji").get() as { count: number };
        const mediaCount = db.prepare("select count(*) as count from media_assets").get() as {
          count: number;
        };
        const wordCount = db.prepare("select count(*) as count from words").get() as { count: number };
        const wordMeaningCount = db.prepare("select count(*) as count from word_meanings").get() as { count: number };
        const wordKanjiCount = db.prepare("select count(*) as count from word_kanji").get() as { count: number };
        const readingCount = db.prepare("select count(*) as count from kanji_readings").get() as { count: number };

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
        assert.equal(readingCount.count, 1);
        assert.deepEqual(readings, [
          { type: "on", reading: "GU", meaning: null, usefulness: null, position: 0 },
        ]);
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
