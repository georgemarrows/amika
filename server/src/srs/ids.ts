import { createHash, randomUUID } from "node:crypto";

import type { SrsCardKind } from "./types.js";

const idSeparator = "\x1f";

function sha256Text(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildSrsCardId(kanjiLiteral: string, cardKind: SrsCardKind) {
  return `srs-card-${sha256Text(`${kanjiLiteral}${idSeparator}${cardKind}`).slice(0, 16)}`;
}

export function buildSrsReviewId() {
  return `srs-review-${randomUUID()}`;
}
