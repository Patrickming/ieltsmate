import {
  AlertCircle,
  CheckCircle2,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useId, useMemo, useState } from "react";
import type { Category } from "../../data/mockData";
import type { Note } from "../../data/mockData";
import { useAppStore, type ProviderConfig } from "../../store/useAppStore";

function categoryToCardType(
  category: Category,
): "word-speech" | "phrase" | "synonym" | "sentence" | "spelling" {
  if (category === "口语" || category === "单词") return "word-speech";
  if (category === "短语") return "phrase";
  if (category === "同义替换") return "synonym";
  if (category === "句子") return "sentence";
  if (category === "拼写") return "spelling";
  return "word-speech";
}

interface AiContentShape {
  fallback?: boolean;
}

function resolveReviewModelLabel(
  reviewModel: string,
  providers: ProviderConfig[],
): { label: string; title: string } {
  const fallbackModel = providers[0]?.models[0]?.id ?? "";
  const configuredModel = reviewModel || fallbackModel;

  if (!configuredModel) {
    return { label: "未配置模型", title: "当前没有可用的 AI 模型配置" };
  }

  for (const provider of providers) {
    const matched = provider.models.find((model) => {
      if (model.id === configuredModel) return true;
      if (model.id.endsWith(`/${configuredModel}`)) return true;
      return model.id.split("/").pop() === configuredModel;
    });

    if (matched) {
      const shortModel = matched.id.split("/").pop() || matched.id;
      const providerName = provider.displayName || provider.name;
      return {
        label: `${shortModel}（${providerName}）`,
        title: `${providerName} / ${matched.id}`,
      };
    }
  }

  return {
    label: configuredModel.split("/").pop() || configuredModel,
    title: configuredModel,
  };
}

function cellStatus(
  noteId: string,
  aiContent: Record<string, unknown>,
  aiLoading: Record<string, boolean>,
): "loading" | "pending" | "ok" | "failed" {
  if (aiLoading[noteId]) return "loading";
  const raw = aiContent[noteId] as AiContentShape | null | undefined;
  if (raw == null || typeof raw !== "object") return "pending";
  if (!("fallback" in raw)) return "pending";
  if (raw.fallback === true) return "failed";
  return "ok";
}

/** 根据滑动窗口张数 (通常 1–15) 调整密度，避免格条过挤或留白过多 */
function getDensityLayout(total: number) {
  if (total <= 4) {
    return {
      trackClass: "h-[11px] gap-2",
      cellRounded: "rounded-md",
      gridMinPx: 10,
      labelClass: "text-[11px] tracking-wide",
      statPill: "text-[11px] px-2.5 py-1",
    };
  }
  if (total <= 8) {
    return {
      trackClass: "h-[9px] gap-1.5",
      cellRounded: "rounded-sm",
      gridMinPx: 7,
      labelClass: "text-[11px] tracking-wide",
      statPill: "text-[10px] px-2 py-0.5",
    };
  }
  if (total <= 12) {
    return {
      trackClass: "h-[8px] gap-1",
      cellRounded: "rounded-sm",
      gridMinPx: 5,
      labelClass: "text-[10px] tracking-[0.02em]",
      statPill: "text-[10px] px-1.5 py-0.5",
    };
  }
  return {
    trackClass: "h-[7px] gap-0.5",
    cellRounded: "rounded-[3px]",
    gridMinPx: 4,
    labelClass: "text-[10px] tracking-[0.02em]",
    statPill: "text-[10px] px-1.5 py-0.5",
  };
}

/** 侧栏：每条为横向色带，高度随张数变化 */
function getSidebarSegmentBarClass(total: number) {
  if (total <= 4) return "h-2.5";
  if (total <= 8) return "h-2";
  if (total <= 12) return "h-1.5";
  return "h-1.5";
}

type SegmentItem = {
  id: string;
  label: string;
  status: "loading" | "pending" | "ok" | "failed";
};

/** 悬浮窗内竖条：固定短宽，避免每条横杠拉满整栏显得又长又空 */
const VERT_BAR_W = "w-14";

function WarmupSegmentCells({
  segments,
  start,
  layout,
  mode,
  sidebarBarClass,
}: {
  segments: SegmentItem[];
  start: number;
  layout: ReturnType<typeof getDensityLayout>;
  mode: "horizontal" | "vertical";
  sidebarBarClass: string;
}) {
  return segments.map((seg, idx) => {
    const title = `${seg.label} · ${
      seg.status === "ok"
        ? "完整联想已就绪"
        : seg.status === "failed"
          ? "降级结果（可重试）"
          : seg.status === "loading"
            ? "生成中…"
            : "排队等待"
    } · ${start + idx + 1}/${segments.length}`;
    const seq = start + idx + 1;

    const baseH =
      mode === "vertical"
        ? `relative ${VERT_BAR_W} shrink-0 ${sidebarBarClass} transition-all duration-300 ease-out ring-1 ring-white/[0.04] ${layout.cellRounded}`
        : "relative flex-1 min-w-0 transition-all duration-300 ease-out ring-1 ring-white/[0.04] " +
          layout.cellRounded;

    if (mode === "horizontal") {
      if (seg.status === "ok") {
        return (
          <motion.div
            key={seg.id}
            layout
            title={title}
            initial={false}
            animate={{ scale: 1 }}
            className={
              baseH +
              " bg-gradient-to-b from-emerald-400/90 to-emerald-600/85 shadow-[0_0_12px_rgba(52,211,153,0.25)]"
            }
          />
        );
      }
      if (seg.status === "failed") {
        return (
          <motion.div
            key={seg.id}
            layout
            title={title}
            className={
              baseH +
              " bg-gradient-to-b from-amber-400/85 to-amber-700/70 shadow-[0_0_10px_rgba(251,191,36,0.2)]"
            }
          />
        );
      }
      if (seg.status === "loading") {
        return (
          <motion.div
            key={seg.id}
            layout
            title={title}
            className={baseH + " overflow-hidden bg-primary/25"}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/55 to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ repeat: Infinity, duration: 1.15, ease: "linear" }}
            />
          </motion.div>
        );
      }
      return (
        <div key={seg.id} title={title} className={baseH + " bg-zinc-700/55"} />
      );
    }

    if (mode === "vertical") {
      const row = (
        dotColorClass: string,
        textColorClass: string,
        isPulsing = false,
        statusText = "",
      ) => (
        <div
          key={seg.id}
          className="group flex items-center justify-between w-full py-1.5 px-2 cursor-help hover:bg-white/5 rounded-md transition-colors"
          title={title}
        >
          <span className="w-5 shrink-0 text-center font-mono text-[11px] font-bold text-white/90 tabular-nums">
            {seq}
          </span>
          <div className="flex-1 mx-2 flex items-center justify-center">
            <div
              className={`h-1.5 w-12 rounded-full opacity-80 group-hover:opacity-100 transition-opacity ${dotColorClass} ${isPulsing ? "animate-pulse" : ""}`}
            />
          </div>
          <span
            className={`w-12 shrink-0 text-center text-[10px] font-bold tracking-wider ${textColorClass}`}
          >
            {statusText}
          </span>
        </div>
      );

      if (seg.status === "ok")
        return row("bg-emerald-400", "text-emerald-400", false, "就绪");
      if (seg.status === "failed")
        return row("bg-amber-400", "text-amber-400", false, "降级");
      if (seg.status === "loading")
        return row("bg-primary", "text-primary", true, "预热中");
      return row("bg-zinc-600", "text-zinc-400", false, "排队");
    }

    // Fallback for unexpected cases
    return <div key={seg.id} className={baseH + " bg-zinc-700/55"} />;
  });
}

export interface ReviewAIWarmupBarProps {
  /** top：顶栏横条；floating：复习页右侧悬浮层（不占布局宽度，默认） */
  variant?: "top" | "floating";
}

export function ReviewAIWarmupBar({
  variant = "floating",
}: ReviewAIWarmupBarProps) {
  const ringGradId = useId().replace(/:/g, "");
  const reviewSession = useAppStore((s) => s.reviewSession);
  const reviewPrepareBatchSize = useAppStore((s) => s.reviewPrepareBatchSize);
  const retryAIContent = useAppStore((s) => s.retryAIContent);
  const reviewModel = useAppStore((s) => s.reviewModel);
  const providers = useAppStore((s) => s.providers);
  const [isHovered, setIsHovered] = useState(false);
  const [isSticky, setIsSticky] = useState(false);

  const snapshot = useMemo(() => {
    if (
      !reviewSession?.sessionId ||
      reviewSession.skipAi ||
      reviewSession.cards.length === 0
    )
      return null;

    const batch = Math.max(1, reviewPrepareBatchSize);
    const start = reviewSession.current;
    const end = Math.min(start + batch, reviewSession.cards.length);
    const windowCards: Note[] = reviewSession.cards.slice(start, end);

    const { aiContent, aiLoading } = reviewSession;
    let ok = 0;
    let failed = 0;
    let loading = 0;
    let pending = 0;
    const failedNotes: Note[] = [];

    for (const note of windowCards) {
      const st = cellStatus(
        note.id,
        aiContent as Record<string, unknown>,
        aiLoading,
      );
      if (st === "ok") ok += 1;
      else if (st === "failed") {
        failed += 1;
        failedNotes.push(note);
      } else if (st === "loading") loading += 1;
      else pending += 1;
    }

    const total = windowCards.length;
    const doneFull = ok;
    const segments = windowCards.map((note) => ({
      id: note.id,
      label: note.content.trim() || "（无标题）",
      status: cellStatus(
        note.id,
        aiContent as Record<string, unknown>,
        aiLoading,
      ),
    }));

    return {
      total,
      doneFull,
      failed,
      loading,
      pending,
      failedNotes,
      segments,
      start,
      end,
    };
  }, [reviewSession, reviewPrepareBatchSize]);

  if (!snapshot) return null;

  const {
    total,
    doneFull,
    failed,
    loading,
    pending,
    failedNotes,
    segments,
    start,
    end,
  } = snapshot;
  const layout = getDensityLayout(total);
  const pctFull = total > 0 ? Math.round((doneFull / total) * 100) : 0;
  const ringR = 15.5;
  const ringC = 2 * Math.PI * ringR;
  const sidebarSegH = getSidebarSegmentBarClass(total);
  const modelLabel = resolveReviewModelLabel(reviewModel, providers);

  const bgDecor = (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#12121a] via-[#0c0c12] to-[#0a0a10]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 -top-12 h-40 w-64 rounded-full bg-primary/[0.07] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-16 bottom-0 h-28 w-48 rounded-full bg-emerald-500/[0.06] blur-3xl"
        aria-hidden
      />
    </>
  );

  const ringChart = (sizeClass: string, hideText = false) => (
    <div className={`relative shrink-0 ${sizeClass}`}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden>
        <circle
          cx="18"
          cy="18"
          r={ringR}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-white/[0.06]"
        />
        <circle
          cx="18"
          cy="18"
          r={ringR}
          fill="none"
          stroke={`url(#${ringGradId})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={ringC}
          strokeDashoffset={ringC * (1 - pctFull / 100)}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
        <defs>
          <linearGradient id={ringGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
      </svg>
      {!hideText && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums text-text-secondary">
          {pctFull}%
        </span>
      )}
    </div>
  );

  const renderStatPills = (wrapClass: string, isLarge = false) => {
    const pillClass = isLarge ? "text-xs px-2.5 py-1" : layout.statPill;
    const iconSize = isLarge ? 12 : 11;
    return (
      <div className={wrapClass}>
        <span
          className={`inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/[0.12] font-medium text-emerald-200/95 ${pillClass}`}
        >
          完整 {doneFull}/{total}
        </span>
        {loading > 0 && (
          <span
            className={`inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/[0.12] font-medium text-primary ${pillClass}`}
          >
            <Loader2
              size={iconSize}
              className="animate-spin shrink-0 opacity-90"
            />
            {loading}
          </span>
        )}
        {pending > 0 && (
          <span
            className={`inline-flex items-center rounded-full border border-zinc-600/50 bg-zinc-800/60 font-medium text-text-dim ${pillClass}`}
          >
            待拉取 {pending}
          </span>
        )}
        {failed > 0 && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full border border-amber-500/35 bg-amber-500/[0.12] font-medium text-amber-100/95 ${pillClass}`}
          >
            <AlertCircle size={iconSize} className="shrink-0 opacity-90" />
            降级 {failed}
          </span>
        )}
      </div>
    );
  };

  const anyFailedLoading = failedNotes.some(
    (n) => reviewSession!.aiLoading[n.id] === true,
  );

  const retryAllFailed = () => {
    for (const note of failedNotes) {
      if (reviewSession!.aiLoading[note.id]) continue;
      retryAIContent(
        note.id,
        categoryToCardType(note.category as Category),
      );
    }
  };

  const failedSection = failedNotes.length > 0 && (
    <div
      className={
        variant === "floating"
          ? "mt-2 flex flex-col gap-1 border-t border-white/10 pt-2"
          : "flex flex-col gap-2 mt-3"
      }
    >
      {failedNotes.length > 1 && (
        <button
          type="button"
          onClick={retryAllFailed}
          aria-label="一键重试全部降级项"
          className={
            variant === "floating"
              ? "mb-0.5 flex w-full items-center justify-center gap-1 rounded-md border border-amber-400/35 bg-amber-500/20 py-1.5 text-[10px] font-semibold text-amber-100 transition-colors hover:bg-amber-500/30"
              : "mb-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-500/15 py-2 text-[11px] font-semibold text-amber-100 shadow-sm transition-colors hover:bg-amber-500/25"
          }
        >
          {anyFailedLoading ? (
            <>
              <Loader2 size={variant === "floating" ? 11 : 12} className="animate-spin shrink-0" />
              重试中…
            </>
          ) : (
            <>
              <RefreshCw size={variant === "floating" ? 11 : 12} className="shrink-0" />
              一键重试（{failedNotes.length}）
            </>
          )}
        </button>
      )}
      {failedNotes.map((note) => {
        const retrying = reviewSession!.aiLoading[note.id] ?? false;

        if (variant === "floating") {
          return (
            <div
              key={note.id}
              className="flex items-center justify-between gap-2 rounded bg-amber-500/10 px-1.5 py-1"
            >
              <span
                className="min-w-0 flex-1 truncate text-[10px] text-amber-200"
                title={note.content}
              >
                {note.content.trim() || note.id}
              </span>
              <button
                type="button"
                disabled={retrying}
                onClick={() =>
                  retryAIContent(
                    note.id,
                    categoryToCardType(note.category as Category),
                  )
                }
                className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
              >
                {retrying ? "..." : "重试"}
              </button>
            </div>
          );
        }

        return (
          <motion.div
            key={note.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="group flex w-full max-w-full items-center gap-2 rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-950/40 to-amber-950/10 px-2.5 py-1.5 shadow-sm backdrop-blur-sm"
          >
            <span
              className="min-w-0 flex-1 truncate text-[11px] font-medium text-amber-50/95"
              title={note.content}
            >
              {note.content.trim() || note.id}
            </span>
            <button
              type="button"
              disabled={retrying}
              onClick={() =>
                retryAIContent(
                  note.id,
                  categoryToCardType(note.category as Category),
                )
              }
              className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-500/15 px-2 py-1 text-[10px] font-semibold text-amber-100 transition-all hover:border-amber-400/45 hover:bg-amber-500/25 disabled:opacity-50"
            >
              {retrying ? (
                <>
                  <Loader2 size={11} className="animate-spin" />
                  重试中
                </>
              ) : (
                <>
                  <RefreshCw size={11} />
                  重新预热
                </>
              )}
            </button>
          </motion.div>
        );
      })}
    </div>
  );

  const readyLine = failed === 0 &&
    loading === 0 &&
    pending === 0 &&
    total > 0 && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`flex items-center justify-center gap-1.5 text-[10px] font-medium text-emerald-400/75 ${variant === "floating" ? "mt-2 shrink-0 border-t border-white/[0.05] pt-3" : "mt-2.5"}`}
      >
        <CheckCircle2 size={12} className="shrink-0 opacity-90" />
        本窗口内联想已全部就绪
      </motion.div>
    );

  const isExpanded = isHovered || isSticky || failed > 0;

  if (variant === "floating") {
    return (
      <aside
        className="absolute right-14 top-20 z-50 flex flex-col items-center w-[180px]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="region"
        aria-label="当前滑动窗口内 AI 联想预热状态"
      >
        <motion.div
          layout
          onClick={() => setIsSticky((prev) => !prev)}
          className={`flex h-9 cursor-pointer items-center gap-2 overflow-hidden rounded-full border bg-[#0a0a12]/95 px-3 shadow-[0_4px_12px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-colors ${
            isSticky
              ? "border-primary/50 ring-1 ring-primary/20"
              : failed > 0
                ? "border-amber-500/50"
                : "border-white/[0.12] hover:border-white/20"
          }`}
        >
          {ringChart("h-4 w-4 shrink-0", true)}
          <span
            className={`text-xs font-medium leading-none ${failed > 0 ? "text-amber-200" : "text-text-secondary"}`}
          >
            预热 {doneFull}/{total}
          </span>
        </motion.div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 8 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="w-full overflow-hidden rounded-xl border border-white/[0.12] bg-[#0a0a12]/95 shadow-[0_12px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            >
              <div className="flex flex-col p-3">
                {/* 丰富的头部信息 */}
                <div className="mb-3 flex flex-col items-center gap-1.5 border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-1.5 text-text-secondary">
                    <Sparkles size={14} className="shrink-0 text-primary/70" />
                    <span className="text-sm font-semibold">AI 预热状态</span>
                  </div>
                  <p className="text-xs text-text-dim">
                    第 {start + 1}–{end} 张 · 共{" "}
                    <span className="tabular-nums font-medium text-text-muted">
                      {total}
                    </span>{" "}
                    条
                  </p>
                  <div className="mt-1">
                    {renderStatPills(
                      "flex flex-wrap justify-center gap-1",
                      true,
                    )}
                  </div>
                  <div
                    className="max-w-full truncate text-[10px] leading-none text-text-subtle"
                    title={modelLabel.title}
                  >
                    模型：<span className="text-text-dim">{modelLabel.label}</span>
                  </div>
                </div>

                {/* 进度条列表 */}
                <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
                  <WarmupSegmentCells
                    segments={segments}
                    start={start}
                    layout={layout}
                    mode="vertical"
                    sidebarBarClass=""
                  />
                </div>

                {failedSection}
                {readyLine}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>
    );
  }

  return (
    <div
      className="shrink-0 relative overflow-hidden border-b border-white/[0.06]"
      role="region"
      aria-label="当前滑动窗口内 AI 联想预热状态"
    >
      {bgDecor}

      <div className="relative px-4 py-3">
        {/* 标题行 */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              aria-hidden
            >
              <Layers size={15} className="text-primary/90" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Sparkles size={12} className="text-primary/70 shrink-0" />
                <span className="text-xs font-semibold tracking-tight bg-gradient-to-r from-text-secondary to-text-muted bg-clip-text text-transparent">
                  滑动窗口 · AI 预热
                </span>
              </div>
              <p
                className={`mt-0.5 text-text-dim ${layout.labelClass} truncate`}
              >
                第 {start + 1}–{end} 张 · 本窗口共{" "}
                <span className="tabular-nums text-text-muted font-medium">
                  {total}
                </span>{" "}
                条
                {total !== reviewPrepareBatchSize &&
                  total < reviewPrepareBatchSize && (
                    <span className="text-text-subtle">（会话将尽）</span>
                  )}
              </p>
            </div>
          </div>

          {/* 环形进度 + 数字 */}
          <div className="flex items-center gap-3 shrink-0">
            {ringChart("h-11 w-11")}
            <div
              className="hidden sm:block h-8 w-px bg-white/[0.08]"
              aria-hidden
            />
            {renderStatPills(
              "flex flex-wrap gap-1.5 justify-end max-w-[min(100%,280px)] sm:max-w-none",
            )}
          </div>
        </div>

        {/* 格条轨道：张数多时允许横向轻滚动，避免极窄屏挤爆 */}
        <div
          className={`rounded-2xl border border-white/[0.07] bg-black/25 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_0_rgba(0,0,0,0.3)] backdrop-blur-sm ${
            total > 10 ? "overflow-x-auto" : ""
          }`}
        >
          <div
            className={`flex w-full min-w-0 ${layout.trackClass} ${total > 10 ? "min-w-[min(100%,520px)]" : ""}`}
            style={
              total > 10
                ? {
                    minWidth: `${Math.max(280, total * layout.gridMinPx + (total - 1) * (total <= 12 ? 4 : 2))}px`,
                  }
                : undefined
            }
          >
            <WarmupSegmentCells
              segments={segments}
              start={start}
              layout={layout}
              mode="horizontal"
              sidebarBarClass={sidebarSegH}
            />
          </div>
        </div>

        {failedSection}
        {readyLine}
      </div>
    </div>
  );
}
