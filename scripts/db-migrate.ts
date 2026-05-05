import { defaultDatabasePath, openDatabase, runMigrations } from "../server/src/db/index.js";

const dbPath = process.env.AMIKA_DB_PATH ?? defaultDatabasePath;
const db = openDatabase({ path: dbPath });

try {
  const result = runMigrations(db);
  console.log(
    JSON.stringify(
      {
        dbPath,
        applied: result.applied,
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
