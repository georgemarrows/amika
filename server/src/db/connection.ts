import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import DatabaseConstructor from "better-sqlite3";
import type { Database as DatabaseConnection } from "better-sqlite3";

export type Db = DatabaseConnection;

export type OpenDatabaseOptions = {
  path?: string;
  readonly?: boolean;
  fileMustExist?: boolean;
};

export const defaultDatabasePath = join(process.cwd(), ".var", "amika.sqlite");

export function openDatabase(options: OpenDatabaseOptions = {}): Db {
  const dbPath = options.path ?? process.env.AMIKA_DB_PATH ?? defaultDatabasePath;
  const readonly = options.readonly ?? false;
  const databaseOptions: ConstructorParameters<typeof DatabaseConstructor>[1] = {
    readonly,
  };

  if (dbPath !== ":memory:" && !readonly) {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  if (options.fileMustExist !== undefined) {
    databaseOptions.fileMustExist = options.fileMustExist;
  }

  const db = new DatabaseConstructor(dbPath, databaseOptions);

  db.pragma("foreign_keys = ON");

  if (dbPath !== ":memory:" && !readonly) {
    db.pragma("journal_mode = WAL");
  }

  return db;
}
