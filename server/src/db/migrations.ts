import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Db } from "./connection.js";

export type MigrationResult = {
  applied: string[];
};

export const defaultMigrationsDir = join(process.cwd(), "server", "src", "db", "migrations");

type Migration = {
  id: string;
  sql: string;
};

function ensureMigrationTable(db: Db) {
  db.exec(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at text not null
    );
  `);
}

function readMigrations(migrationsDir: string): Migration[] {
  return readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => ({
      id: fileName,
      sql: readFileSync(join(migrationsDir, fileName), "utf8"),
    }));
}

export function runMigrations(db: Db, migrationsDir = defaultMigrationsDir): MigrationResult {
  ensureMigrationTable(db);

  const appliedRows = db.prepare("select id from schema_migrations").all() as Array<{ id: string }>;
  const appliedIds = new Set(appliedRows.map((row) => row.id));
  const pending = readMigrations(migrationsDir).filter((migration) => !appliedIds.has(migration.id));
  const applied: string[] = [];

  const applyPending = db.transaction(() => {
    const recordMigration = db.prepare(
      "insert into schema_migrations (id, applied_at) values (?, ?)",
    );

    for (const migration of pending) {
      db.exec(migration.sql);
      recordMigration.run(migration.id, new Date().toISOString());
      applied.push(migration.id);
    }
  });

  applyPending();

  return { applied };
}
