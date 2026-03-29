import type { ReactNode } from 'react'

export type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-16 px-4 text-center ${className}`}
      role="status"
    >
      <div className="max-w-sm">
        <p className="text-text-muted text-sm font-medium">{title}</p>
        {description ? <p className="text-text-subtle text-xs mt-1.5 leading-relaxed">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-col items-center gap-4 mt-1">{action}</div> : null}
    </div>
  )
}
