import { useCallback, useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { BookOpen, RefreshCw, Sparkles } from 'lucide-react'
import { apiUrl } from '../../lib/apiBase'
import { Button } from './Button'

export type DashboardInsightData = {
  summary: string
  encouragement: string
  /** 雅思实用干货（听说读写/词汇/应试技巧等） */
  ieltsTip: string
  generatedAt: string
  nextRefreshAt: string
}

/** 自动刷新完全由服务端 nextRefreshAt + 单次 setTimeout 驱动，不再用短间隔轮询（避免与 15 分钟冷却不一致） */

function formatCST(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

async function readFetchError(res: Response): Promise<string> {
  const t = await res.text().catch(() => '')
  try {
    const j = JSON.parse(t) as { message?: string }
    if (j?.message && typeof j.message === 'string') return j.message
  } catch {
    /* plain text */
  }
  return t || `HTTP ${res.status}`
}

function useInsightTypewriter(
  summary: string,
  encouragement: string,
  ieltsTip: string,
  runKey: string,
  enabled: boolean,
) {
  const [summaryShown, setSummaryShown] = useState('')
  const [encouragementShown, setEncouragementShown] = useState('')
  const [tipShown, setTipShown] = useState('')
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    if (!enabled || !runKey) {
      setSummaryShown(summary)
      setEncouragementShown(encouragement)
      setTipShown(ieltsTip)
      setTyping(false)
      return
    }

    setSummaryShown('')
    setEncouragementShown('')
    setTipShown('')
    setTyping(true)

    const summaryChars = [...summary]
    const encChars = [...encouragement]
    const tipChars = [...ieltsTip]
    const timers: ReturnType<typeof setTimeout>[] = []
    let cancelled = false

    const delayFor = (ch: string | undefined) => {
      if (!ch) return 20
      return /[\u4e00-\u9fff]/.test(ch) ? 24 : 14
    }

    const schedule = (fn: () => void, ms: number) => {
      const t = window.setTimeout(() => {
        if (!cancelled) fn()
      }, ms)
      timers.push(t)
    }

    let si = 0
    const stepSummary = () => {
      if (cancelled) return
      if (si < summaryChars.length) {
        const ch = summaryChars[si]
        si += 1
        setSummaryShown(summaryChars.slice(0, si).join(''))
        schedule(stepSummary, delayFor(ch))
        return
      }
      if (encChars.length === 0) {
        startTip()
        return
      }
      let ei = 0
      const stepEnc = () => {
        if (cancelled) return
        if (ei < encChars.length) {
          const ch = encChars[ei]
          ei += 1
          setEncouragementShown(encChars.slice(0, ei).join(''))
          schedule(stepEnc, delayFor(ch))
        } else {
          startTip()
        }
      }
      schedule(stepEnc, delayFor(encChars[0]))
    }

    const startTip = () => {
      if (cancelled) return
      if (tipChars.length === 0) {
        setTyping(false)
        return
      }
      let ti = 0
      const stepTip = () => {
        if (cancelled) return
        if (ti < tipChars.length) {
          const ch = tipChars[ti]
          ti += 1
          setTipShown(tipChars.slice(0, ti).join(''))
          schedule(stepTip, delayFor(ch))
        } else {
          setTyping(false)
        }
      }
      schedule(stepTip, delayFor(tipChars[0]))
    }

    schedule(stepSummary, 90)

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [summary, encouragement, ieltsTip, runKey, enabled])

  return { summaryShown, encouragementShown, tipShown, typing }
}

export function DashboardInsight() {
  const [data, setData] = useState<DashboardInsightData | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regenerateOk, setRegenerateOk] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const load = useCallback(async (opts?: { force?: boolean }) => {
    const force = opts?.force ?? false
    setError(null)
    if (force) {
      setRegenerateOk(false)
      setRegenerating(true)
    } else {
      setLoading(true)
    }
    try {
      const res = force
        ? await fetch(apiUrl('/dashboard/insight?refresh=1'))
        : await fetch(apiUrl('/dashboard/insight'))
      if (!res.ok) {
        const msg = await readFetchError(res)
        const hint =
          res.status === 404
            ? '（若刚更新过代码，请重启后端服务以注册 /dashboard/insight 路由。）'
            : ''
        throw new Error(`${msg}${hint}`)
      }
      const json = (await res.json()) as { data?: DashboardInsightData }
      if (
        json.data &&
        typeof json.data.summary === 'string' &&
        typeof json.data.nextRefreshAt === 'string'
      ) {
        setData({
          ...json.data,
          ieltsTip: typeof json.data.ieltsTip === 'string' ? json.data.ieltsTip : '',
        })
        if (force) setRegenerateOk(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setRegenerating(false)
    }
  }, [])

  useEffect(() => {
    if (!regenerateOk) return
    const t = window.setTimeout(() => setRegenerateOk(false), 6000)
    return () => clearTimeout(t)
  }, [regenerateOk])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!data?.nextRefreshAt) return
    const ms = new Date(data.nextRefreshAt).getTime() - Date.now()
    if (ms <= 0) {
      const t = window.setTimeout(() => void load(), 500)
      return () => clearTimeout(t)
    }
    const t = window.setTimeout(() => void load(), ms + 800)
    return () => clearTimeout(t)
  }, [data?.nextRefreshAt, load])

  const typingEnabled =
    !prefersReducedMotion && !loading && !regenerating && !!data

  const { summaryShown, encouragementShown, tipShown, typing } = useInsightTypewriter(
    data?.summary ?? '',
    data?.encouragement ?? '',
    data?.ieltsTip ?? '',
    data?.generatedAt ?? '',
    typingEnabled,
  )

  const sumLen = data?.summary?.length ?? 0
  const encLen = data?.encouragement?.length ?? 0
  const tipLen = data?.ieltsTip?.length ?? 0
  const cursorInSummary = typing && summaryShown.length < sumLen
  const cursorInEnc =
    typing && encLen > 0 && summaryShown.length >= sumLen && encouragementShown.length < encLen
  const encDone = sumLen === 0 || summaryShown.length >= sumLen
  const cursorInTip =
    typing &&
    tipLen > 0 &&
    encDone &&
    (encLen === 0 || encouragementShown.length >= encLen) &&
    tipShown.length < tipLen

  const cursorBlock = (
    <span
      className="inline-block w-2.5 h-5 ml-0.5 align-[-3px] bg-primary/70 rounded-sm motion-safe:animate-pulse"
      aria-hidden
    />
  )

  return (
    <div className="bg-surface-card border border-border rounded-xl p-6 min-w-0 overflow-hidden">
      {(loading || regenerating) && (
        <div
          className="h-0.5 rounded-full mb-4 opacity-90"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(129,140,248,0.55), transparent)',
            backgroundSize: '200% 100%',
            animation: 'insightStream 1.2s ease-in-out infinite',
          }}
        />
      )}

      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-5 h-5 text-primary shrink-0" aria-hidden />
          <span className="text-base font-semibold text-text-secondary">学习洞察</span>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 min-w-0 ml-auto">
          {data?.generatedAt && (
            <span className="text-xs text-text-subtle tabular-nums">
              更新于 {formatCST(data.generatedAt)}（东八区）
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1 shrink-0"
            disabled={loading || regenerating}
            icon={<RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />}
            onClick={() => void load({ force: true })}
          >
            重新生成
          </Button>
        </div>
      </div>

      <p className="text-xs text-text-subtle leading-relaxed mb-3 -mt-1">
        内容保存在服务器。每次自动刷新或点击「重新生成」时，后端会读取<strong className="text-text-muted font-medium">已保存的上一轮全文</strong>
        写入 AI 提示词，并要求换角度、换措辞；同时加入随机盐，降低与上次雷同的概率。
      </p>

      {regenerateOk && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-lg border border-emerald-500/35 bg-emerald-950/30 px-3.5 py-2.5 text-sm text-emerald-200/95 leading-relaxed"
        >
          已重新生成成功。本轮已参考上一轮保存的内容，并提示模型避免重复表述。
        </div>
      )}

      {loading && !data && (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-[#27272a] rounded w-full" />
          <div className="h-4 bg-[#27272a] rounded w-[92%]" />
          <div className="h-4 bg-[#27272a] rounded w-[70%]" />
        </div>
      )}

      {!loading && error && (
        <p className="text-[15px] text-amber-400/90 whitespace-pre-wrap break-words leading-relaxed">
          暂时无法加载洞察：{error}
        </p>
      )}

      {data && (
        <div className="flex flex-col gap-4">
          <p className="text-[15px] md:text-base leading-relaxed text-text-muted whitespace-pre-wrap min-h-[1.6em]">
            {summaryShown}
            {cursorInSummary ? cursorBlock : null}
          </p>
          {data.encouragement ? (
            <p className="text-[15px] md:text-base leading-relaxed text-text-dim italic border-l-[3px] border-primary/45 pl-3.5 min-h-[1.6em]">
              {encouragementShown}
              {cursorInEnc ? cursorBlock : null}
            </p>
          ) : null}

          {data.ieltsTip ? (
            <div className="rounded-lg border border-border-strong/60 bg-[#141418]/80 px-3.5 py-3">
              <div className="flex items-center gap-1.5 mb-2 text-text-muted">
                <BookOpen className="w-4 h-4 text-cat-vocab shrink-0" aria-hidden />
                <span className="text-sm font-medium">雅思干货</span>
              </div>
              <p className="text-[15px] md:text-base leading-relaxed text-text-secondary whitespace-pre-wrap min-h-[1.6em]">
                {tipShown}
                {cursorInTip ? cursorBlock : null}
              </p>
            </div>
          ) : null}

          {data.nextRefreshAt && (
            <p className="text-xs text-text-subtle pt-1">
              下次自动刷新（东八区，约 15 分钟一轮）：{formatCST(data.nextRefreshAt)}
            </p>
          )}
        </div>
      )}

      <style>{`
        @keyframes insightStream {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
    </div>
  )
}
