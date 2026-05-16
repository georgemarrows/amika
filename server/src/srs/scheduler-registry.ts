import { scheduleSimpleSm2, simpleSm2SchedulerVersion } from "./simple-sm2.js";
import type { SrsScheduler } from "./types.js";

const schedulers: Record<string, SrsScheduler> = {
  [simpleSm2SchedulerVersion]: scheduleSimpleSm2,
};

export function getSrsScheduler(version: string): SrsScheduler | null {
  return schedulers[version] ?? null;
}
