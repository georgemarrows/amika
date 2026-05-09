import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { openDatabase } from "../server/src/db/index.js";
import { backupSqliteDatabase } from "./sqlite-backup.js";

describe("SQLite backups", () => {
  test("creates a verified backup for an existing file database", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-backup-test-"));
    const dbPath = join(tempDir, "amika.sqlite");
    const backupDir = join(tempDir, "backups");
    const db = openDatabase({ path: dbPath });

    try {
      db.prepare("create table example (value text not null)").run();
      db.prepare("insert into example (value) values (?)").run("kept");
      db.close();

      const backupPath = await backupSqliteDatabase({
        dbPath,
        backupDir,
        now: "2026-05-05T00:00:00.000Z",
      });

      assert.ok(backupPath);
      assert.equal(existsSync(backupPath), true);

      const backupDb = openDatabase({
        path: backupPath,
        readonly: true,
        fileMustExist: true,
      });

      try {
        assert.deepEqual(backupDb.prepare("select value from example").get(), { value: "kept" });
      } finally {
        backupDb.close();
      }
    } finally {
      if (db.open) {
        db.close();
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("returns null when there is no database file to back up", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-missing-backup-test-"));

    try {
      assert.equal(
        await backupSqliteDatabase({
          dbPath: join(tempDir, "missing.sqlite"),
          backupDir: join(tempDir, "backups"),
        }),
        null,
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
