import { Skeleton } from './Skeleton'
import { Spinner } from './Spinner'

export type LoadingStateProps = {
  className?: string
}

/** Full-page style placeholder using Skeleton blocks (for future async data). */
export function LoadingState({ className = '' }: LoadingStateProps) {
  return (
    <div
      className={`flex flex-col gap-5 p-8 max-w-5xl mx-auto w-full ${className}`}
      role="status"
      aria-busy="true"
      aria-label="加载中"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex shrink-0" aria-hidden>
            <Spinner size="sm" />
          </span>
          <Skeleton className="h-9 flex-1 max-w-56" rounded="md" />
        </div>
        <Skeleton className="h-4 w-72 max-w-full" rounded="sm" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-24" rounded="md" />
        <Skeleton className="h-24" rounded="md" />
        <Skeleton className="h-24" rounded="md" />
        <Skeleton className="h-24" rounded="md" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-40" rounded="md" />
        <Skeleton className="h-40" rounded="md" />
        <Skeleton className="h-40" rounded="md" />
      </div>
    </div>
  )
}
