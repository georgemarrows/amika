export { defaultDatabasePath, openDatabase } from "./connection.js";
export type { Db, OpenDatabaseOptions } from "./connection.js";
export { defaultMigrationsDir, runMigrations } from "./migrations.js";
export type { MigrationResult } from "./migrations.js";
export {
  getKanjiReadings,
  getMediaAssetById,
  getKanjiByLiteral,
  getWordById,
  getWordsForKanji,
  insertKanjiStubIfMissing,
  replaceKanjiReadings,
  listKanji,
  listWords,
  upsertKanji,
  upsertMediaAsset,
  upsertSourceDeck,
  upsertSourceRecord,
  upsertWord,
  upsertWordMeaning,
  replaceWordKanji,
} from "./repositories.js";
export type {
  KanjiReadingInput,
  KanjiReadingRow,
  KanjiStubInput,
  KanjiInput,
  KanjiListRow,
  KanjiRow,
  MediaAssetInput,
  MediaAssetRow,
  SourceDeckInput,
  SourceRecordInput,
  WordDetailRow,
  WordInput,
  WordKanjiInput,
  WordKanjiRow,
  WordListRow,
  WordMeaningInput,
  WordMeaningRow,
  WordSummaryRow,
} from "./repositories.js";
