import { GRADE_THRESHOLDS } from '../core/config/scoring';
import type { Grade } from '../core/types';
import { finiteOr } from './finite';

/** Grade + passenger star rating (docs/GAME_DESIGN.md §10). */

/** S ≥ 7500 · A ≥ 6000 · B ≥ 4500 · C ≥ 3000 · D below · F when the run failed */
export function gradeFor(total: number, failed: boolean): Grade {
  if (failed) return 'F';
  const t = finiteOr(total);
  for (const [grade, min] of GRADE_THRESHOLDS) if (t >= min) return grade;
  return 'D';
}

/**
 * `1 + 4 × comfort/100` rounded to the nearest 0.5 (halves round up), −1 when late, never below 1 or above 5.
 * A failed run is always rated 1; a non-finite comfort counts as 0.
 */
export function starsFor(comfort: number, late: boolean, failed: boolean): number {
  if (failed) return 1;
  const c = Math.min(100, Math.max(0, finiteOr(comfort)));
  const raw = 1 + (4 * c) / 100;
  const rounded = Math.round(raw * 2) / 2;
  return Math.min(5, Math.max(1, rounded - (late ? 1 : 0)));
}

const ORDER: readonly Grade[] = ['F', 'D', 'C', 'B', 'A', 'S'];

/** 0 (F) … 5 (S) */
export const gradeRank = (g: Grade): number => ORDER.indexOf(g);

/** the better of a stored best (or none) and a new grade */
export const betterGrade = (best: Grade | null, g: Grade): Grade =>
  best === null || gradeRank(g) > gradeRank(best) ? g : best;
