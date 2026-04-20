# Review AI Warmup Bar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Review AI Warmup Bar into a compact, expandable pill component to minimize visual interference with the main flashcard content.

**Architecture:** We will replace the current wide, fixed layout in `ReviewAIWarmupBar.tsx` with a dual-state component: a default "pill" state (showing only a micro progress ring and brief text) and an expanded state (triggered by hover or the presence of failed AI tasks) that drops down a minimal list of tasks and retry buttons. We will use `framer-motion` for smooth expansion.

**Tech Stack:** React, Tailwind CSS, Framer Motion, Lucide React

---

### Task 1: Refactor Base Component Structure & State

**Files:**
- Modify: `frontend/src/components/review/ReviewAIWarmupBar.tsx`

- [ ] **Step 1: Add hover state and layout wrapper**

```tsx
// Inside ReviewAIWarmupBar component, before the return statement:
const [isHovered, setIsHovered] = useState(false)
const isExpanded = isHovered || failed > 0

// Wrap the main return (for variant === 'floating') with a container that handles hover:
if (variant === 'floating') {
  return (
    <aside
      className="absolute right-4 top-20 z-50 flex flex-col items-end"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="region"
      aria-label="当前滑动窗口内 AI 联想预热状态"
    >
       {/* Pill and Expanded Content will go here */}
    </aside>
  )
}
```

- [ ] **Step 2: Commit base structure**

```bash
git add frontend/src/components/review/ReviewAIWarmupBar.tsx
git commit -m "refactor(review): setup hover state and container for expandable pill"
```

### Task 2: Implement the Pill Header (Collapsed State)

**Files:**
- Modify: `frontend/src/components/review/ReviewAIWarmupBar.tsx`

- [ ] **Step 1: Create the Pill UI**

```tsx
// Replace the previous aside content with the Pill UI:
      <motion.div
        layout
        className={`flex h-8 cursor-pointer items-center gap-2 overflow-hidden rounded-full border bg-[#0a0a12]/95 px-2 shadow-[0_4px_12px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-colors ${
          failed > 0 ? 'border-amber-500/50' : 'border-white/[0.12] hover:border-white/20'
        }`}
      >
        {ringChart('h-4 w-4 shrink-0')}
        <span className={`text-[11px] font-medium leading-none ${failed > 0 ? 'text-amber-200' : 'text-text-secondary'}`}>
          预热 {doneFull}/{total}
        </span>
      </motion.div>
```

- [ ] **Step 2: Adjust `ringChart` helper for micro size**

Ensure the `ringChart` function works well at `h-4 w-4` by optionally hiding the percentage text if the size is small, or keeping it hidden in the pill entirely. Update `ringChart` definition:

```tsx
  const ringChart = (sizeClass: string, hideText = false) => (
    <div className={`relative shrink-0 ${sizeClass}`}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden>
        {/* circles remain the same */}
      </svg>
      {!hideText && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums text-text-secondary">
          {pctFull}%
        </span>
      )}
    </div>
  )
// Update the call in the pill: {ringChart('h-4 w-4 shrink-0', true)}
```

- [ ] **Step 3: Commit Pill UI**

```bash
git add frontend/src/components/review/ReviewAIWarmupBar.tsx
git commit -m "feat(review): implement compact pill header for warmup bar"
```

### Task 3: Implement the Expandable List

**Files:**
- Modify: `frontend/src/components/review/ReviewAIWarmupBar.tsx`

- [ ] **Step 1: Create the Expanded Dropdown container**

```tsx
// Below the Pill motion.div, add the expanded container:
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="w-48 overflow-hidden rounded-xl border border-white/[0.12] bg-[#0a0a12]/95 shadow-[0_12px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
             <div className="flex flex-col p-2">
                {/* Expanded content goes here */}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
```
*(Ensure `AnimatePresence` and `useState` are imported from `framer-motion` and `react`)*

- [ ] **Step 2: Redesign `WarmupSegmentCells` for ultra-compact vertical list**

Update the `WarmupSegmentCells` internal rendering for `vertical` mode to be a simple dot + text line:

```tsx
    // Inside WarmupSegmentCells, replace the 'vertical' rendering logic:
    const row = (dotColorClass: string, isPulsing = false) => (
      <div key={seg.id} className="flex w-full items-center gap-2 rounded px-1.5 py-1 hover:bg-white/5" title={title}>
        <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColorClass} ${isPulsing ? 'animate-pulse' : ''}`} />
        <span className="flex-1 truncate text-[10px] text-text-secondary/80">{seg.label}</span>
      </div>
    )

    if (seg.status === 'ok') return row('bg-emerald-400')
    if (seg.status === 'failed') return row('bg-amber-400')
    if (seg.status === 'loading') return row('bg-primary', true)
    return row('bg-zinc-600')
```

- [ ] **Step 3: Integrate the new cells and failed section into the expanded container**

```tsx
// Inside the <div className="flex flex-col p-2"> from Step 1:
              <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto pr-1">
                <WarmupSegmentCells
                  segments={segments}
                  start={start}
                  layout={layout}
                  mode="vertical"
                  sidebarBarClass=""
                />
              </div>
              {failedSection}
```

- [ ] **Step 4: Commit Expandable List**

```bash
git add frontend/src/components/review/ReviewAIWarmupBar.tsx
git commit -m "feat(review): implement expandable dropdown list for warmup details"
```

### Task 4: Refine Failed Section and Cleanup

**Files:**
- Modify: `frontend/src/components/review/ReviewAIWarmupBar.tsx`

- [ ] **Step 1: Make `failedSection` more compact**

```tsx
// Update the failedSection rendering:
  const failedSection = failedNotes.length > 0 && (
    <div className="mt-2 flex flex-col gap-1 border-t border-white/10 pt-2">
      {failedNotes.map((note) => {
        const retrying = reviewSession!.aiLoading[note.id] ?? false
        return (
          <div key={note.id} className="flex items-center justify-between gap-2 rounded bg-amber-500/10 px-1.5 py-1">
             <span className="min-w-0 flex-1 truncate text-[10px] text-amber-200" title={note.content}>
               {note.content.trim() || note.id}
             </span>
             <button
               type="button"
               disabled={retrying}
               onClick={() => retryAIContent(note.id, categoryToCardType(note.category as Category))}
               className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
             >
               {retrying ? '...' : '重试'}
             </button>
          </div>
        )
      })}
    </div>
  )
```

- [ ] **Step 2: Clean up unused code**
Remove old UI elements that are no longer needed in the `floating` variant (e.g., `bgDecor`, `renderStatPills`, large `ringChart`, `readyLine`). Ensure the `top` variant (if still used elsewhere) remains functional or is intentionally replaced. *For this plan, we focus on the floating variant redesign.*

- [ ] **Step 3: Commit Final Refinements**

```bash
git add frontend/src/components/review/ReviewAIWarmupBar.tsx
git commit -m "style(review): compact failed section and remove unused warmup bar UI elements"
```