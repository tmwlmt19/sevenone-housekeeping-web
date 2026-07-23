import type { Task, TaskPriority } from '@/lib/api/types'

// Sort weight per status (lower sorts first). Uses a string map + fallback so
// 'pending_approval' (added with the approval-flow work) already has a slot.
const STATUS_RANK: Record<string, number> = {
  in_progress: 0,
  assigned: 1,
  pending_approval: 2,
  pending: 3,
  completed: 4,
}

const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  normal: 1,
  low: 2,
}

type TaskLike = Pick<Task, 'status' | 'priority' | 'due_date'>

/**
 * A not-yet-completed task whose due date is before today. Dates are compared in
 * the local timezone, matching how the app formats due dates elsewhere
 * (format.ts). Due dates are date-only in the product.
 */
export function isOverdue(task: TaskLike): boolean {
  if (!task.due_date || task.status === 'completed') return false
  const due = new Date(task.due_date)
  if (Number.isNaN(due.getTime())) return false
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  return dueDay.getTime() < startOfToday.getTime()
}

/** Overdue, not-done tasks are treated as urgent (manual-testing backlog). */
export function effectivePriority(task: TaskLike): TaskPriority {
  return isOverdue(task) ? 'urgent' : task.priority
}

/** Urgency comparator (overdue-aware); urgent first. */
export function compareByUrgency(a: TaskLike, b: TaskLike): number {
  return PRIORITY_RANK[effectivePriority(a)] - PRIORITY_RANK[effectivePriority(b)]
}

/** Full task order: status first, then urgency within the status. */
export function compareTasks(a: TaskLike, b: TaskLike): number {
  const byStatus = (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99)
  return byStatus !== 0 ? byStatus : compareByUrgency(a, b)
}
