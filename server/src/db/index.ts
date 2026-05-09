export { defaultDatabasePath, openDatabase } from "./connection.js";
export type { Db, OpenDatabaseOptions } from "./connection.js";
export { defaultMigrationsDir, runMigrations } from "./migrations.js";
export type { MigrationResult } from "./migrations.js";
export {
  getMediaAssetById,
  getKanjiByLiteral,
  getWordById,
  getWordsForKanji,
  insertKanjiStubIfMissing,
  upsertKanji,
  upsertMediaAsset,
  upsertSourceDeck,
  upsertSourceRecord,
  upsertWord,
  upsertWordMeaning,
  replaceWordKanji,
} from "./repositories.js";
export type {
  KanjiStubInput,
  KanjiInput,
  KanjiRow,
  MediaAssetInput,
  MediaAssetRow,
  SourceDeckInput,
  SourceRecordInput,
  WordDetailRow,
  WordInput,
  WordKanjiInput,
  WordKanjiRow,
  WordMeaningInput,
  WordMeaningRow,
  WordSummaryRow,
} from "./repositories.js";
