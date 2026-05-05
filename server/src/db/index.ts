export { defaultDatabasePath, openDatabase } from "./connection.js";
export type { Db, OpenDatabaseOptions } from "./connection.js";
export { defaultMigrationsDir, runMigrations } from "./migrations.js";
export type { MigrationResult } from "./migrations.js";
export {
  getKanjiByLiteral,
  upsertKanji,
  upsertMediaAsset,
  upsertSourceDeck,
  upsertSourceRecord,
} from "./repositories.js";
export type {
  KanjiInput,
  KanjiRow,
  MediaAssetInput,
  MediaAssetRow,
  SourceDeckInput,
  SourceRecordInput,
} from "./repositories.js";
