import type { DurationTable } from './auto-assign'

/**
 * Room-type → cleaning-minutes "properties" file. Static defaults, edited here
 * to retune — there is no backend for this (see `auto-assign-plan.md` §4). Keys
 * are UPPERCASE to match how the backend normalizes `rooms.room_type`
 * (`_normalize_room_type`: trim + uppercase). Unknown / null types fall back to
 * DEFAULT_ROOM_MINUTES.
 *
 * The optimized auto-assign modal seeds its editable rows from these, auto-adding
 * any room_type present in the hotel that's missing here (at the default), and
 * lets a manager tweak the numbers for a single run — those edits are held in
 * local state only and are never persisted.
 */
export const DEFAULT_ROOM_MINUTES = 25

export const ROOM_TYPE_MINUTES: Record<string, number> = {
  STD: 20, // standard
  DLX: 30, // deluxe
  STE: 40, // suite
}

/** The default lookup, as the algorithm consumes it. */
export function defaultDurationTable(): DurationTable {
  return { byType: { ...ROOM_TYPE_MINUTES }, default: DEFAULT_ROOM_MINUTES }
}
