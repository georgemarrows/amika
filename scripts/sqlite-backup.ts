import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";

import DatabaseConstructor from "better-sqlite3";

export type SqliteBackupOptions = {
  dbPath: string;
  now?: string;
  backupDir?: string;
};

export async function backupSqliteDatabase(options: SqliteBackupOptions): Promise<string | null> {
  if (options.dbPath === ":memory:" || !existsSync(options.dbPath)) {
    return null;
  }

  const sourcePath = resolve(options.dbPath);
  const backupDir = options.backupDir ?? join(dirname(sourcePath), "backups");
  const backupPath = nextBackupPath(sourcePath, backupDir, options.now ?? new Date().toISOString());
  const sourceDb = new DatabaseConstructor(sourcePath, {
    readonly: true,
    fileMustExist: true,
  });

  mkdirSync(backupDir, { recursive: true });

  try {
    await sourceDb.backup(backupPath);
  } finally {
    sourceDb.close();
  }

  verifySqliteBackup(backupPath);

  return backupPath;
}

export function verifySqliteBackup(dbPath: string) {
  const backupDb = new DatabaseConstructor(dbPath, {
    readonly: true,
    fileMustExist: true,
  });

  try {
    const row = backupDb.prepare("pragma integrity_check").get() as { integrity_check: string };

    if (row.integrity_check !== "ok") {
      throw new Error(`Backup integrity check failed for ${dbPath}: ${row.integrity_check}`);
    }
  } finally {
    backupDb.close();
  }
}

function nextBackupPath(sourcePath: string, backupDir: string, now: string) {
  const extension = extname(sourcePath) || ".sqlite";
  const stem = basename(sourcePath, extension);
  const timestamp = formatTimestamp(now);
  let candidate = join(backupDir, `${stem}-${timestamp}${extension}`);
  let suffix = 2;

  while (existsSync(candidate)) {
    candidate = join(backupDir, `${stem}-${timestamp}-${suffix}${extension}`);
    suffix += 1;
  }

  return candidate;
}

function formatTimestamp(now: string) {
  return new Date(now).toISOString().replaceAll("-", "").replaceAll(":", "").replace("T", "-").replace("Z", "Z");
}
