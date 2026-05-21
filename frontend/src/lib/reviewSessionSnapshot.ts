/** 当前标签页内暂停的复习场次（刷新可恢复；关标签页后清除） */
export const REVIEW_SESSION_SNAPSHOT_KEY = 'ielts_review_session_snapshot'

/** 同标签页内有效时长（毫秒） */
export const REVIEW_SESSION_SNAPSHOT_EXPIRY_MS = 24 * 60 * 60 * 1000

export interface ReviewSessionSnapshotParams {
  source: 'notes' | 'favorites'
  categories?: string[]
  range: 'all' | 'wrong' | 'exclude_mastered' | 'new_only'
  mode: 'random' | 'continue'
  order?: 'random' | 'sequential'
  skipAi?: boolean
}

export interface ReviewSessionSnapshot {
  sessionId: string
  cardIds: string[]
  current: number
  results: { id: string; rating: 'easy' | 'again' }[]
  params: ReviewSessionSnapshotParams
  skipAi: boolean
  aiContent: Record<string, { fallback: boolean; reason?: string; [key: string]: unknown } | null>
  aiLoading: Record<string, boolean>
  savedExtensionCount: number
  completedOffset: number
  timestamp: number
}

export function loadReviewSessionSnapshot(): ReviewSessionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(REVIEW_SESSION_SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ReviewSessionSnapshot
    if (!parsed?.sessionId || !Array.isArray(parsed.cardIds) || parsed.cardIds.length === 0) {
      sessionStorage.removeItem(REVIEW_SESSION_SNAPSHOT_KEY)
      return null
    }
    if (Date.now() - (parsed.timestamp ?? 0) > REVIEW_SESSION_SNAPSHOT_EXPIRY_MS) {
      sessionStorage.removeItem(REVIEW_SESSION_SNAPSHOT_KEY)
      return null
    }
    return parsed
  } catch {
    sessionStorage.removeItem(REVIEW_SESSION_SNAPSHOT_KEY)
    return null
  }
}

export function saveReviewSessionSnapshot(snapshot: ReviewSessionSnapshot): void {
  try {
    sessionStorage.setItem(
      REVIEW_SESSION_SNAPSHOT_KEY,
      JSON.stringify({ ...snapshot, timestamp: Date.now() }),
    )
  } catch {
    /* sessionStorage 满或不可用 */
  }
}

export function clearReviewSessionSnapshot(): void {
  try {
    sessionStorage.removeItem(REVIEW_SESSION_SNAPSHOT_KEY)
  } catch {
    /* ignore */
  }
}

export function countWarmedInSnapshot(
  aiContent: ReviewSessionSnapshot['aiContent'],
  cardIds: string[],
): number {
  return cardIds.filter((id) => {
    const raw = aiContent[id]
    return raw != null && typeof raw === 'object' && 'fallback' in raw
  }).length
}
