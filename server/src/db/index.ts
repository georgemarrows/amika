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
  searchLibrary,
  upsertKanji,
  upsertMediaAsset,
  upsertSourceDeck,
  upsertSourceRecord,
  upsertWord,
  upsertWordMeaning,
  replaceWordKanji,
} from "./repositories.js";
export {
  disableKanjiSrs,
  enableKanjiSrs,
  getSrsCardById,
  getSrsCardsForKanji,
  insertSrsReview,
  listDueSrsCards,
  updateSrsCardState,
} from "./srs-repositories.js";
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
export type {
  SrsCardStateUpdateInput,
  SrsReviewInsertInput,
} from "./srs-repositories.js";
