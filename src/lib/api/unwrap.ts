// Helpers for turning openapi-fetch results into plain values that throw a
// typed error on failure (so TanStack Query treats them as errors).

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface FetchResult<T> {
  data?: T
  error?: unknown
  response: Response
}

/** FastAPI returns `{ detail: string }` or a validation-error array in `detail`. */
function messageFromError(error: unknown, status: number): string {
  if (error && typeof error === 'object' && 'detail' in error) {
    const detail = (error as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      const msgs = detail
        .map((d) =>
          d && typeof d === 'object' && 'msg' in d ? String(d.msg) : null,
        )
        .filter((m): m is string => m !== null)
      if (msgs.length > 0) return msgs.join('; ')
    }
  }
  return `Request failed (${status})`
}

/** Return the response body, or throw `ApiError` on a non-2xx / error result. */
export function unwrap<T>(result: FetchResult<T>): T {
  if (result.error !== undefined || result.data === undefined) {
    throw new ApiError(
      result.response.status,
      messageFromError(result.error, result.response.status),
    )
  }
  return result.data
}

/** For endpoints with no response body (e.g. 204 DELETE): throw on failure. */
export function ensureOk(result: FetchResult<unknown>): void {
  if (!result.response.ok) {
    throw new ApiError(
      result.response.status,
      messageFromError(result.error, result.response.status),
    )
  }
}
