import { describe, expect, it } from 'vitest'

import type { Task, TaskStatus } from '@/lib/api/types'

import { activeTaskForRoom } from './tasks'

/** Minimal task for the room-lookup tests. */
function task(id: string, roomId: string, status: TaskStatus): Task {
  return {
    id,
    hotel_id: 'h1',
    room_id: roomId,
    assigned_to: null,
    status,
    priority: 'normal',
    notes: null,
    due_date: null,
    started_at: null,
    completed_at: null,
    created_at: '2026-08-05T00:00:00Z',
    updated_at: '2026-08-05T00:00:00Z',
  }
}

describe('activeTaskForRoom', () => {
  it('returns undefined when there are no tasks', () => {
    expect(activeTaskForRoom(undefined, 'r1')).toBeUndefined()
    expect(activeTaskForRoom([], 'r1')).toBeUndefined()
  })

  it('finds the room’s live task across the active statuses', () => {
    for (const status of [
      'pending',
      'assigned',
      'in_progress',
      'pending_approval',
    ] as TaskStatus[]) {
      const t = task('t1', 'r1', status)
      expect(activeTaskForRoom([t], 'r1')).toBe(t)
    }
  })

  it('ignores completed tasks (the room is done, not live)', () => {
    expect(activeTaskForRoom([task('t1', 'r1', 'completed')], 'r1')).toBeUndefined()
  })

  it('only matches the requested room', () => {
    const tasks = [task('t1', 'r1', 'assigned'), task('t2', 'r2', 'assigned')]
    expect(activeTaskForRoom(tasks, 'r2')?.id).toBe('t2')
    expect(activeTaskForRoom(tasks, 'r3')).toBeUndefined()
  })
})
