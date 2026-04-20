# Review AI Warmup Bar Redesign

## Objective

Redesign the `ReviewAIWarmupBar` component in the review page. The current design is too wide and visually intrusive, blocking the main flashcard content. The goal is to create a highly compact, non-intrusive "pill" style component that expands only when necessary or upon user interaction, minimizing visual clutter while retaining essential status data.

## Architecture & Components

The redesigned `ReviewAIWarmupBar` will transition from a fixed wide panel to an expandable "pill" (悬浮药丸) component.

*   **Pill Component (Default State):**
    *   A small, rounded pill positioned on the right side.
    *   Contains a micro ring chart (e.g., 16px diameter) showing overall progress.
    *   Displays minimal text, e.g., "预热 6/10" (Ready/Total).
    *   Background changes subtly based on state (e.g., normal vs. has errors).
*   **Expanded List (Hover/Error State):**
    *   Drops down from the pill when hovered.
    *   Automatically expands if there are any failed/degraded AI content fetches requiring user attention (retries).
    *   **List Items:** Each item represents a card in the current window.
        *   Shows a tiny status dot (green/yellow/spinning loader).
        *   Truncated label (word/phrase).
    *   **Retry Section:** Failed items will have a compact retry button.

## Data Flow

The component continues to consume data from `useAppStore` (`reviewSession`, `reviewPrepareBatchSize`).
The status calculation logic (`cellStatus`, `snapshot` useMemo) remains largely the same, but the output format is optimized for the new vertical, compact layout.

## Error Handling

*   **Degraded Content (Failed):** If any card fails AI warmup (fallback), the expanded list will show the failed cards prominently with a small retry button. The pill itself might subtly indicate an error state (e.g., a small warning dot or border color change).
*   **Auto-expand:** The presence of failed items will override the default collapsed state to ensure the user is aware of the need to retry.

## Visual Specifications

*   **Pill Dimensions:** ~100px width, ~32px height.
*   **Colors:** Inherit from the existing theme (Emerald for success, Amber for warning/failed, Primary for loading).
*   **Animations:** Smooth expansion/collapse using `framer-motion` (height animation and opacity).

## Implementation Steps

1.  Create the Pill header UI (micro ring chart + minimal text).
2.  Implement the hover/expand logic (state management for `isHovered` or `isExpanded`).
3.  Redesign the `WarmupSegmentCells` to be a vertical list of extremely compact items (dot + text).
4.  Integrate the failed items section directly into the expanded list.
5.  Apply smooth transitions using `framer-motion`.