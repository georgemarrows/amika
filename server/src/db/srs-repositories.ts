import { buildSrsCardId } from "../srs/ids.js";
import { simpleSm2SchedulerVersion } from "../srs/simple-sm2.js";
import type {
  SrsCard,
  SrsCardKind,
  SrsNextCardState,
  SrsReviewRating,
  SrsReviewRow,
} from "../srs/types.js";
import type { Db } from "./connection.js";

type SrsCardDbRow = {
  id: string;
  kanji_literal: string;
  card_kind: SrsCardKind;
  enabled: 0 | 1;
  scheduler_version: string;
  state: SrsCard["state"];
  due_at: string;
  interval_days: number;
  ease_factor: number;
  reps: number;
  lapses: number;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type SrsReviewDbRow = {
  id: string;
  card_id: string;
  reviewed_at: string;
  rating: SrsReviewRating;
  previous_state_json: string;
  next_state_json: string;
};

export type SrsReviewInsertInput = {
  id: string;
  cardId: string;
  reviewedAt: string;
  rating: SrsReviewRating;
  previousStateJson: string;
  nextStateJson: string;
};

export type SrsCardStateUpdateInput = SrsNextCardState;

const kanjiCardKinds: SrsCardKind[] = ["kanji_recognition", "kanji_production"];

function toSrsCard(row: SrsCardDbRow): SrsCard {
  return {
    id: row.id,
    kanjiLiteral: row.kanji_literal,
    cardKind: row.card_kind,
    enabled: row.enabled === 1,
    schedulerVersion: row.scheduler_version,
    state: row.state,
    dueAt: row.due_at,
    intervalDays: row.interval_days,
    easeFactor: row.ease_factor,
    reps: row.reps,
    lapses: row.lapses,
    lastReviewedAt: row.last_reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSrsReview(row: SrsReviewDbRow): SrsReviewRow {
  return {
    id: row.id,
    cardId: row.card_id,
    reviewedAt: row.reviewed_at,
    rating: row.rating,
    previousStateJson: row.previous_state_json,
    nextStateJson: row.next_state_json,
  };
}

export function enableKanjiSrs(db: Db, literal: string, now: string): SrsCard[] {
  const upsert = db.prepare(`
    insert into srs_cards (
      id,
      kanji_literal,
      card_kind,
      enabled,
      scheduler_version,
      state,
      due_at,
      interval_days,
      ease_factor,
      reps,
      lapses,
      last_reviewed_at,
      created_at,
      updated_at
    )
    values (
      @id,
      @kanjiLiteral,
      @cardKind,
      1,
      @schedulerVersion,
      'new',
      @now,
      0,
      2.5,
      0,
      0,
      null,
      @now,
      @now
    )
    on conflict(kanji_literal, card_kind) do update set
      enabled = 1,
      scheduler_version = excluded.scheduler_version,
      state = excluded.state,
      due_at = excluded.due_at,
      interval_days = excluded.interval_days,
      ease_factor = excluded.ease_factor,
      reps = excluded.reps,
      lapses = excluded.lapses,
      last_reviewed_at = excluded.last_reviewed_at,
      updated_at = excluded.updated_at
  `);

  for (const cardKind of kanjiCardKinds) {
    upsert.run({
      id: buildSrsCardId(literal, cardKind),
      kanjiLiteral: literal,
      cardKind,
      schedulerVersion: simpleSm2SchedulerVersion,
      now,
    });
  }

  return getSrsCardsForKanji(db, literal);
}

export function disableKanjiSrs(db: Db, literal: string, now: string): SrsCard[] {
  db.prepare(`
    update srs_cards
    set enabled = 0,
        updated_at = ?
    where kanji_literal = ?
      and card_kind in ('kanji_recognition', 'kanji_production')
  `).run(now, literal);

  return getSrsCardsForKanji(db, literal);
}

export function getSrsCardById(db: Db, cardId: string): SrsCard | null {
  const row = db
    .prepare(
      `
      select
        id,
        kanji_literal,
        card_kind,
        enabled,
        scheduler_version,
        state,
        due_at,
        interval_days,
        ease_factor,
        reps,
        lapses,
        last_reviewed_at,
        created_at,
        updated_at
      from srs_cards
      where id = ?
      `,
    )
    .get(cardId) as SrsCardDbRow | undefined;

  return row ? toSrsCard(row) : null;
}

export function getSrsCardsForKanji(db: Db, literal: string): SrsCard[] {
  return db
    .prepare(
      `
      select
        id,
        kanji_literal,
        card_kind,
        enabled,
        scheduler_version,
        state,
        due_at,
        interval_days,
        ease_factor,
        reps,
        lapses,
        last_reviewed_at,
        created_at,
        updated_at
      from srs_cards
      where kanji_literal = ?
      order by card_kind
      `,
    )
    .all(literal)
    .map((row) => toSrsCard(row as SrsCardDbRow));
}

export function listDueSrsCards(db: Db, now: string, limit: number): SrsCard[] {
  return db
    .prepare(
      `
      select
        id,
        kanji_literal,
        card_kind,
        enabled,
        scheduler_version,
        state,
        due_at,
        interval_days,
        ease_factor,
        reps,
        lapses,
        last_reviewed_at,
        created_at,
        updated_at
      from srs_cards
      where enabled = 1
        and due_at <= ?
      order by
        due_at,
        case when state = 'new' then 1 else 0 end,
        created_at,
        id
      limit ?
      `,
    )
    .all(now, limit)
    .map((row) => toSrsCard(row as SrsCardDbRow));
}

export function insertSrsReview(db: Db, input: SrsReviewInsertInput): SrsReviewRow {
  db.prepare(`
    insert into srs_reviews (
      id,
      card_id,
      reviewed_at,
      rating,
      previous_state_json,
      next_state_json
    )
    values (
      @id,
      @cardId,
      @reviewedAt,
      @rating,
      @previousStateJson,
      @nextStateJson
    )
  `).run(input);

  const row = db
    .prepare(
      `
      select
        id,
        card_id,
        reviewed_at,
        rating,
        previous_state_json,
        next_state_json
      from srs_reviews
      where id = ?
      `,
    )
    .get(input.id) as SrsReviewDbRow;

  return toSrsReview(row);
}

export function updateSrsCardState(
  db: Db,
  cardId: string,
  input: SrsCardStateUpdateInput,
): SrsCard | null {
  const result = db.prepare(`
    update srs_cards
    set state = @state,
        due_at = @dueAt,
        interval_days = @intervalDays,
        ease_factor = @easeFactor,
        reps = @reps,
        lapses = @lapses,
        last_reviewed_at = @lastReviewedAt,
        updated_at = @updatedAt
    where id = @cardId
  `).run({ ...input, cardId });

  if (result.changes !== 1) {
    return null;
  }

  return getSrsCardById(db, cardId);
}
