import { useState, useEffect } from 'react'
import { Plus, Database, Download, Upload, Sun, Moon } from 'lucide-react'
import { motion } from 'framer-motion'
import { Layout } from '../components/layout/Layout'
import {
  useAppStore,
  type ProviderConfig,
  REVIEW_PREPARE_TIMEOUT_CHOICES_MS,
} from '../store/useAppStore'

/** 将设置里存的 modelId（可能为旧版短名）规范为当前提供商列表中的完整 id，供下拉 value 使用 */
function canonicalModelIdFromStored(stored: string, providers: ProviderConfig[]): string {
  if (!stored) return ''
  for (const p of providers) {
    for (const m of p.models) {
      if (m.id === stored) return m.id
    }
  }
  for (const p of providers) {
    for (const m of p.models) {
      if (m.id.endsWith(`/${stored}`)) return m.id
      const tail = m.id.split('/').pop()
      if (tail === stored) return m.id
    }
  }
  return stored
}

function resolveSlotDraft(
  classifyModel: string,
  reviewModel: string,
  chatModel: string,
  providers: ProviderConfig[],
) {
  const firstSel = providers[0]?.selectedModel || ''
  const secondSel = providers[1]?.selectedModel || ''
  return {
    classify: canonicalModelIdFromStored(classifyModel || firstSel, providers),
    review: canonicalModelIdFromStored(reviewModel || secondSel || firstSel, providers),
    chat: canonicalModelIdFromStored(chatModel || firstSel, providers),
  }
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-lg font-semibold text-text-primary">{children}</h2>
}

const MODEL_SLOTS = [
  { id: 'classify', label: '分类识别', tip: '用于自动识别笔记分类' },
  { id: 'review', label: '复习联想', tip: '用于复习时生成延伸内容' },
  { id: 'chat', label: 'AI 助手', tip: '用于 AI 对话助手' },
]

export default function Settings() {
  const {
    openAIConfig,
    openImport,
    theme,
    setTheme,
    providers,
    classifyModel,
    reviewModel,
    chatModel,
    settingsLoaded,
    commitModelSlots,
    reviewPrepareBatchSize,
    reviewPrepareTimeoutMs,
    setReviewPrepareBatchSize,
    setReviewPrepareTimeoutMs,
  } =
    useAppStore()

  const [slotDraft, setSlotDraft] = useState(() =>
    resolveSlotDraft(classifyModel, reviewModel, chatModel, providers),
  )
  const [slotsDirty, setSlotsDirty] = useState(false)
  const [slotsSaving, setSlotsSaving] = useState(false)

  useEffect(() => {
    if (!settingsLoaded) return
    if (slotsDirty) return
    setSlotDraft(resolveSlotDraft(classifyModel, reviewModel, chatModel, providers))
  }, [settingsLoaded, classifyModel, reviewModel, chatModel, providers, slotsDirty])

  const handleExport = async (format: 'json' | 'csv') => {
    const res = await fetch(`/export/notes?format=${format}`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    a.href = url
    a.download = `ieltsmate-notes-${today}.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const maskKey = (key?: string) => key ? `${key.slice(0, 4)}****` : 'sk-****'

  // option value 必须用后端 AiModel.modelId 完整字符串，否则无法命中数据库配置而回退到默认 GLM
  const allModels = providers.flatMap((p) =>
    p.models.map((m) => {
      const short = m.id.split('/').pop() ?? m.id
      return {
        value: m.id,
        label: `${short}（${p.name}）`,
        key: `${p.id}-${m.id}`,
      }
    }),
  )
  const knownModelIds = new Set(allModels.map((x) => x.value))

  return (
    <Layout title="设置">
      <div className="p-8 max-w-3xl flex flex-col gap-10">

        {/* Section 1: AI 模型配置 */}
        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <SectionTitle>AI 模型配置</SectionTitle>
            <button
              onClick={openAIConfig}
              className="flex items-center gap-1.5 h-9 px-4 bg-primary-btn hover:bg-[#4338ca] rounded-sm text-white text-[13px] font-medium transition-colors"
            >
              <Plus size={14} />
              编辑模型
            </button>
          </div>

          {/* Provider list — show name, key, selected model, status */}
          <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
            {providers.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-4 px-5 py-4 ${i < providers.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary">{p.name}</div>
                  <div className="text-xs text-text-dim mt-0.5">
                    openai-compatible · {maskKey(p.apiKey)}
                  </div>
                </div>
                {/* Show selected model name */}
                {p.selectedModel && (
                  <span className="text-xs text-text-subtle truncate max-w-[160px] hidden sm:block">
                    {p.selectedModel.split('/').pop()}
                  </span>
                )}
                {/* Fallback: show first model if no selectedModel */}
                {!p.selectedModel && p.models.length > 0 && (
                  <span className="text-xs text-text-subtle truncate max-w-[160px] hidden sm:block">
                    {p.models[0].id.split('/').pop()}
                  </span>
                )}
                {(() => {
                  const connected = p.apiKey.length > 0
                  return (
                    <div
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                      style={{
                        background: connected ? '#064e3b' : '#27272a',
                        color: connected ? '#34d399' : '#71717a',
                        border: `1px solid ${connected ? '#34d399' : '#3f3f46'}`,
                      }}
                    >
                      {connected ? '已连接' : '未连接'}
                    </div>
                  )
                })()}
              </div>
            ))}
          </div>

          {/* Default model assignment — 本地草稿，确认后一次性写入后端 */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <div className="text-sm font-medium text-text-muted">默认模型分配</div>
              {slotsDirty && (
                <span className="text-xs text-amber-500/90">已修改，请点击确认保存后生效</span>
              )}
              {!slotsDirty && settingsLoaded && (
                <span className="text-xs text-text-dim hidden sm:inline">
                  以下选项按完整模型 ID 保存，与上游计费名称一致
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MODEL_SLOTS.map((slot) => {
                const currentVal = slotDraft[slot.id as keyof typeof slotDraft]
                return (
                  <div key={slot.id} className="flex flex-col gap-1.5">
                    <span className="text-xs text-text-dim">{slot.label}</span>
                    <select
                      value={currentVal}
                      onChange={(e) => {
                        const v = e.target.value
                        setSlotsDirty(true)
                        setSlotDraft((d) => ({ ...d, [slot.id]: v }))
                      }}
                      className="h-8 bg-[#232328] border border-border rounded-sm px-2 text-xs text-text-muted hover:border-border-strong transition-colors outline-none appearance-none cursor-pointer"
                    >
                      {currentVal && !knownModelIds.has(currentVal) ? (
                        <option value={currentVal}>
                          {currentVal}（当前已保存，列表中无匹配时请重新选择）
                        </option>
                      ) : null}
                      {allModels.map(({ value, label, key }) => (
                        <option key={key} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                type="button"
                disabled={!slotsDirty || slotsSaving || allModels.length === 0}
                onClick={() => {
                  void (async () => {
                    setSlotsSaving(true)
                    await commitModelSlots(slotDraft)
                    setSlotsDirty(false)
                    setSlotsSaving(false)
                  })()
                }}
                className="h-8 px-4 text-xs font-medium rounded-sm bg-primary-btn hover:bg-[#4338ca] text-white transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                {slotsSaving ? '保存中…' : '确认保存'}
              </button>
              <button
                type="button"
                disabled={!slotsDirty || slotsSaving}
                onClick={() => {
                  setSlotDraft(resolveSlotDraft(classifyModel, reviewModel, chatModel, providers))
                  setSlotsDirty(false)
                }}
                className="h-8 px-3 text-xs border border-border rounded-sm text-text-muted hover:bg-[#27272a] transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                放弃更改
              </button>
            </div>
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Section 2: 界面主题 */}
        <section className="flex flex-col gap-4">
          <SectionTitle>界面主题</SectionTitle>
          <div className="bg-surface-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-text-secondary">颜色主题</div>
                <div className="text-xs text-text-dim mt-0.5">切换日间或夜间显示模式</div>
              </div>
              <div className="flex items-center bg-[#232328] rounded-lg p-0.5 gap-0.5">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setTheme('dark')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    theme === 'dark'
                      ? 'bg-primary-btn text-white'
                      : 'text-text-dim hover:text-text-muted'
                  }`}
                >
                  <Moon size={12} />
                  暗色
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setTheme('light')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    theme === 'light'
                      ? 'bg-primary-btn text-white'
                      : 'text-text-dim hover:text-text-muted'
                  }`}
                >
                  <Sun size={12} />
                  日间
                </motion.button>
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Section 3: 复习启动预热 */}
        <section className="flex flex-col gap-4">
          <SectionTitle>复习启动预热</SectionTitle>
          <div className="bg-surface-card border border-border rounded-xl p-5">
            <div className="text-sm font-medium text-text-secondary">启动阶段 AI 预热参数</div>
            <div className="text-xs text-text-dim mt-0.5 mb-4">
              点击「开始复习」后先预热首批卡片再进入；复习过程中会按同一数量保持「当前起向后」的滑动预取（例如 6 张、预热 3 张时，进入第 2 张会开始拉取第 4 张）。
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-text-dim">预热 / 滑动窗口张数</span>
                <select
                  value={String(reviewPrepareBatchSize)}
                  onChange={(e) => { void setReviewPrepareBatchSize(Number(e.target.value)) }}
                  className="h-9 bg-[#232328] border border-border rounded-sm px-2 text-xs text-text-muted hover:border-border-strong transition-colors outline-none appearance-none cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 10, 15].map((n) => (
                    <option key={n} value={n}>{n} 张</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-text-dim">超时时间</span>
                <select
                  value={String(reviewPrepareTimeoutMs)}
                  onChange={(e) => { void setReviewPrepareTimeoutMs(Number(e.target.value)) }}
                  className="h-9 bg-[#232328] border border-border rounded-sm px-2 text-xs text-text-muted hover:border-border-strong transition-colors outline-none appearance-none cursor-pointer"
                >
                  {REVIEW_PREPARE_TIMEOUT_CHOICES_MS.map((ms) => (
                    <option key={ms} value={ms}>{ms / 1000} 秒</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Section 4: 数据管理 */}
        <section className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-text-dim" />
            <SectionTitle>数据管理</SectionTitle>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-card border border-border rounded-xl p-5">
              <div className="text-sm font-medium text-text-secondary mb-1">导出数据</div>
              <div className="text-xs text-text-dim mb-4">将所有笔记导出为文件</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleExport('json')}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs border border-border rounded-sm text-text-muted hover:bg-[#27272a] transition-colors"
                >
                  <Download size={12} />JSON
                </button>
                <button
                  type="button"
                  onClick={() => void handleExport('csv')}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs border border-border rounded-sm text-text-muted hover:bg-[#27272a] transition-colors"
                >
                  <Download size={12} />CSV
                </button>
              </div>
            </div>
            <div className="bg-surface-card border border-border rounded-xl p-5">
              <div className="text-sm font-medium text-text-secondary mb-1">导入数据</div>
              <div className="text-xs text-text-dim mb-4">从文件导入，AI 辅助解析</div>
              <button
                type="button"
                onClick={openImport}
                className="flex items-center gap-1.5 h-8 px-3 text-xs bg-primary-btn hover:bg-[#4338ca] rounded-sm text-white transition-colors"
              >
                <Upload size={12} />选择文件
              </button>
            </div>
          </div>
          <div className="bg-[#2e1520] border border-[#fb7185]/20 rounded-xl p-5">
            <div className="text-sm font-medium text-[#fb7185] mb-1">危险操作</div>
            <div className="text-xs text-[#fb7185]/60 mb-3">清空所有数据，此操作不可撤销</div>
            <button className="h-8 px-4 text-xs bg-[#450a0a] hover:bg-[#7f1d1d] rounded-sm text-[#fb7185] transition-colors">
              清空所有数据
            </button>
          </div>
        </section>
      </div>
    </Layout>
  )
}
