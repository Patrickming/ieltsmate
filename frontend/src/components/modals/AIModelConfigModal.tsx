import { useState } from 'react'
import {
  X, Cpu, Check, ChevronDown, ChevronRight, Eye, EyeOff,
  Plus, Trash2, Lock, Zap, GitBranch, Sparkles, Brain, Globe,
  Bot, Server, Star,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'

// Preset providers with brand colors, icons, base URLs and recommended models
const PRESET_PROVIDERS = [
  { id: 'siliconflow', name: 'SiliconFlow', icon: Zap, color: '#818cf8', baseUrl: 'https://api.siliconflow.cn/v1', recommended: ['Pro/zai-org/GLM-5', 'Pro/MiniMaxAI/MiniMax-M2.5', 'deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct'] },
  { id: 'openrouter', name: 'OpenRouter', icon: GitBranch, color: '#60a5fa', baseUrl: 'https://openrouter.ai/api/v1', recommended: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-2.0-flash', 'meta-llama/llama-3.3-70b-instruct'] },
  { id: 'openai', name: 'OpenAI', icon: Bot, color: '#34d399', baseUrl: 'https://api.openai.com/v1', recommended: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'anthropic', name: 'Anthropic', icon: Brain, color: '#fb7185', baseUrl: 'https://api.anthropic.com/v1', recommended: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'] },
  { id: 'gemini', name: 'Google Gemini', icon: Sparkles, color: '#fbbf24', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', recommended: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { id: 'deepseek', name: 'DeepSeek', icon: Star, color: '#22d3ee', baseUrl: 'https://api.deepseek.com/v1', recommended: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'ollama', name: 'Ollama', icon: Server, color: '#a78bfa', baseUrl: 'http://localhost:11434/v1', recommended: ['llama3.2', 'qwen2.5', 'mistral', 'gemma2'] },
  { id: 'custom', name: '自定义', icon: Globe, color: '#71717a', baseUrl: '', recommended: [] },
]

import type { ProviderConfig } from '../../store/useAppStore'

function ProviderIcon({ presetId, size = 14 }: { presetId: string; size?: number }) {
  const preset = PRESET_PROVIDERS.find((p) => p.id === presetId)
  if (!preset) return <Globe size={size} />
  const Icon = preset.icon
  return <Icon size={size} />
}

export function AIModelConfigModal() {
  const { showAIConfig, closeAIConfig, providers, setProviders } = useAppStore()
  const [selectedId, setSelectedId] = useState(providers[0]?.id ?? '')
  const [showAddDropdown, setShowAddDropdown] = useState(false)
  const [showUnverified, setShowUnverified] = useState(true)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  // Per-model test results for sequential testing
  const [modelTestResults, setModelTestResults] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>({})
  const [testProgress, setTestProgress] = useState<{ done: number; total: number } | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [newModelId, setNewModelId] = useState('')
  const [showRecommended, setShowRecommended] = useState(false)

  const current = providers.find((p) => p.id === selectedId)
  const preset = current ? PRESET_PROVIDERS.find((p) => p.id === current.presetId) : null

  const updateCurrent = (patch: Partial<ProviderConfig>) => {
    setProviders(providers.map((p) => p.id === selectedId ? { ...p, ...patch } : p))
  }

  const handleTest = async () => {
    if (!current || current.models.length === 0) return
    const models = current.models
    setTestProgress({ done: 0, total: models.length })
    setModelTestResults({})
    setTestStatus('testing')

    for (let i = 0; i < models.length; i++) {
      const m = models[i]
      setModelTestResults((prev) => ({ ...prev, [m.id]: 'testing' }))
      await new Promise<void>((resolve) => setTimeout(resolve, 800 + Math.random() * 400))
      const result = current.apiKey.length > 10 ? 'ok' : 'fail'
      setModelTestResults((prev) => ({ ...prev, [m.id]: result }))
      setTestProgress({ done: i + 1, total: models.length })
    }

    // All done
    const allOk = current.apiKey.length > 10
    setTestStatus(allOk ? 'ok' : 'fail')
    setTimeout(() => {
      setTestStatus('idle')
      setTestProgress(null)
    }, 3000)
  }

  const handleAddProvider = (presetId: string) => {
    const preset = PRESET_PROVIDERS.find((p) => p.id === presetId)
    if (!preset) return
    const newId = `p${Date.now()}`
    const newP: ProviderConfig = {
      id: newId,
      name: preset.name,
      displayName: preset.name,
      apiKey: '',
      baseUrl: preset.baseUrl,
      models: [],
      presetId: preset.id,
      color: preset.color,
    }
    setProviders([...providers, newP])
    setSelectedId(newId)
    setShowAddDropdown(false)
  }

  const handleDeleteProvider = (id: string) => {
    setProviders(providers.filter((p) => p.id !== id))
    setSelectedId(providers.find((p) => p.id !== id)?.id ?? '')
  }

  const handleAddModel = (modelId: string) => {
    if (!modelId.trim() || !current) return
    const already = current.models.some((m) => m.id === modelId)
    if (!already) {
      updateCurrent({ models: [...current.models, { id: modelId, verified: false }] })
    }
    setNewModelId('')
    setShowRecommended(false)
  }

  const handleRemoveModel = (modelId: string) => {
    if (!current) return
    updateCurrent({ models: current.models.filter((m) => m.id !== modelId) })
  }

  const displayedModels = current?.models.filter((m) => showUnverified || m.verified) ?? []

  return (
    <AnimatePresence>
      {showAIConfig && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={closeAIConfig}
          />
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            style={{ position: 'fixed', left: '50%', top: '50%', translateX: '-50%', translateY: '-50%', zIndex: 51, maxHeight: '90vh' }}
            className="w-[min(980px,95vw)] bg-[#111113] border border-border rounded-2xl shadow-modal flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="h-14 border-b border-border flex items-center gap-3 px-5 shrink-0">
              <div className="w-8 h-8 bg-[#1e1e3a] rounded-lg flex items-center justify-center">
                <Cpu size={16} className="text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-text-primary">AI 模型配置</div>
                <div className="text-[11px] text-text-dim">配置多个 AI 提供商和模型</div>
              </div>
              <button
                onClick={closeAIConfig}
                className="w-7 h-7 bg-[#27272a] rounded-sm flex items-center justify-center text-text-muted hover:bg-[#3f3f46] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-1 min-h-0" style={{ maxHeight: 'calc(90vh - 56px - 44px)' }}>
              {/* Left sidebar */}
              <div className="w-[220px] border-r border-border flex flex-col shrink-0 bg-[#0d0d0f]">
                <div className="px-3 py-2.5 border-b border-border">
                  <span className="text-[10px] font-semibold text-text-subtle uppercase tracking-wide">提供商</span>
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  {providers.map((p) => {
                    const isSelected = p.id === selectedId
                    const hasKey = p.apiKey.length > 0
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors text-left ${
                          isSelected ? 'bg-[#1c1c20]' : 'hover:bg-[#18181b]'
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                          style={{ background: p.color + '20', color: p.color }}
                        >
                          <ProviderIcon presetId={p.presetId} size={13} />
                        </div>
                        <span className={`text-[13px] flex-1 truncate ${isSelected ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
                          {p.displayName}
                        </span>
                        {hasKey ? (
                          <Check size={13} className="text-[#34d399] shrink-0" />
                        ) : (
                          <ChevronRight size={12} className="text-text-subtle shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Add provider */}
                <div className="border-t border-border p-2 relative">
                  <button
                    onClick={() => setShowAddDropdown(!showAddDropdown)}
                    className="flex items-center gap-1.5 w-full h-8 px-3 rounded-md bg-[#18181b] border border-border text-text-dim hover:border-border-strong hover:text-text-muted transition-colors text-xs"
                  >
                    <Plus size={12} />
                    <span className="flex-1 text-left">添加提供商</span>
                    <ChevronDown size={11} />
                  </button>
                  <AnimatePresence>
                    {showAddDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute bottom-full left-2 right-2 mb-1 bg-[#1c1c20] border border-border rounded-lg shadow-modal z-10 overflow-hidden"
                      >
                        <div className="max-h-56 overflow-y-auto py-1">
                          {PRESET_PROVIDERS.map((p) => {
                            const Icon = p.icon
                            return (
                              <button
                                key={p.id}
                                onClick={() => handleAddProvider(p.id)}
                                className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-[#27272a] transition-colors text-sm text-text-muted hover:text-text-secondary"
                              >
                                <Icon size={13} style={{ color: p.color }} />
                                {p.name}
                              </button>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Right panel */}
              {current ? (
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex-1 overflow-y-auto p-6 flex flex-col gap-5"
                >
                  {/* Provider header */}
                  <div className="flex items-center gap-3 pb-4 border-b border-border">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: current.color + '20', color: current.color }}
                    >
                      <ProviderIcon presetId={current.presetId} size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="text-base font-semibold text-text-primary">{current.displayName}</div>
                      <div className="text-xs text-text-dim mt-0.5">
                        已配置 {current.models.length} 个模型
                      </div>
                    </div>
                    {current.apiKey && (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-[#0d2b1f] border border-[#34d399] rounded-full text-xs text-[#34d399]">
                        <Check size={10} />已验证
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteProvider(current.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d1515] border border-[#fb7185]/30 rounded-md text-xs text-[#fb7185] hover:bg-[#450a0a] transition-colors"
                    >
                      <Trash2 size={12} />
                      删除提供商
                    </button>
                  </div>

                  {/* Config section */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-text-muted text-xs font-semibold uppercase tracking-wide">
                      <Cpu size={12} className="text-primary" />
                      配置
                    </div>

                    {/* Display name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs text-text-dim">
                        <span className="text-[11px]">🏷</span> 显示名称
                      </label>
                      <input
                        value={current.displayName}
                        onChange={(e) => updateCurrent({ displayName: e.target.value })}
                        placeholder={current.name}
                        className="h-9 bg-[#18181b] border border-border rounded-md px-3 text-sm text-text-primary placeholder-text-subtle outline-none focus:border-primary/60 transition-colors"
                      />
                    </div>

                    {/* API Key */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs text-text-dim">
                        <span className="text-[11px]">🔑</span> API 密钥
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1 flex items-center gap-2 h-9 bg-[#18181b] border border-border rounded-md px-3 focus-within:border-primary/60 transition-colors">
                          <input
                            type={showKey ? 'text' : 'password'}
                            value={current.apiKey}
                            onChange={(e) => updateCurrent({ apiKey: e.target.value })}
                            placeholder="sk-..."
                            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-subtle outline-none font-mono"
                          />
                          <button
                            onClick={() => setShowKey(!showKey)}
                            className="text-text-dim hover:text-text-muted transition-colors shrink-0"
                          >
                            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={handleTest}
                          disabled={testStatus === 'testing' || !current.apiKey}
                          className={`h-9 px-4 rounded-md text-sm font-medium transition-colors shrink-0 ${
                            testStatus === 'ok' ? 'bg-[#064e3b] text-[#34d399]' :
                            testStatus === 'fail' ? 'bg-[#450a0a] text-[#fb7185]' :
                            testStatus === 'testing' ? 'bg-[#27272a] text-text-muted' :
                            'bg-primary-btn hover:bg-[#4338ca] text-white disabled:opacity-50'
                          }`}
                        >
                          {testStatus === 'testing'
                            ? testProgress ? `${testProgress.done}/${testProgress.total} 测试中` : '测试中...'
                            : testStatus === 'ok' ? '✓ 全部通过'
                            : testStatus === 'fail' ? '✗ 部分失败'
                            : '逐一测试'}
                        </motion.button>
                      </div>
                    </div>

                    {/* Base URL */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs text-text-dim">
                        <span className="text-[11px]">🔗</span> 基础 URL（可选，例如 {preset?.baseUrl ?? 'https://api.example.com/v1'}）
                      </label>
                      <input
                        value={current.baseUrl}
                        onChange={(e) => updateCurrent({ baseUrl: e.target.value })}
                        placeholder={preset?.baseUrl ?? 'https://api.example.com/v1'}
                        className="h-9 bg-[#18181b] border border-border rounded-md px-3 text-sm text-text-primary placeholder-text-subtle outline-none focus:border-primary/60 transition-colors font-mono"
                      />
                    </div>
                  </div>

                  {/* Models section */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-text-muted text-xs font-semibold uppercase tracking-wide">
                      <Bot size={12} className="text-primary" />
                      模型
                    </div>

                    {/* Add model row */}
                    <div className="flex gap-2 relative">
                      <input
                        value={newModelId}
                        onChange={(e) => setNewModelId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddModel(newModelId)}
                        placeholder="自定义模型 ID..."
                        className="flex-1 h-9 bg-[#18181b] border border-border rounded-md px-3 text-sm text-text-primary placeholder-text-subtle outline-none focus:border-primary/60 transition-colors"
                      />
                      <button
                        onClick={() => handleAddModel(newModelId)}
                        disabled={!newModelId.trim()}
                        className="w-9 h-9 bg-[#1e1e3a] border border-primary/30 rounded-md flex items-center justify-center text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
                      >
                        <Plus size={14} />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setShowRecommended(!showRecommended)}
                          className="h-9 px-3 bg-[#18181b] border border-border rounded-md text-xs text-text-muted hover:border-border-strong transition-colors flex items-center gap-1"
                        >
                          推荐
                          <ChevronDown size={11} />
                        </button>
                        <AnimatePresence>
                          {showRecommended && preset && preset.recommended.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="absolute top-full right-0 mt-1 w-72 bg-[#1c1c20] border border-border rounded-lg shadow-modal z-10 overflow-hidden"
                            >
                              {preset.recommended.map((m) => (
                                <button
                                  key={m}
                                  onClick={() => handleAddModel(m)}
                                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[#27272a] transition-colors text-sm text-text-muted hover:text-text-secondary text-left"
                                >
                                  <Star size={11} className="text-[#fbbf24] shrink-0" />
                                  <span className="truncate font-mono text-xs">{m}</span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Model list */}
                    {displayedModels.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {displayedModels.map((m) => {
                          const mResult = modelTestResults[m.id]
                          return (
                            <div
                              key={m.id}
                              className="flex items-center gap-3 h-11 px-3 bg-[#18181b] border rounded-lg transition-colors"
                              style={{
                                borderColor: mResult === 'ok' ? '#34d399' : mResult === 'fail' ? '#fb7185' : mResult === 'testing' ? '#818cf8' : '#27272a',
                              }}
                            >
                              {/* Test result or default verified state */}
                              <AnimatePresence mode="wait">
                                {mResult === 'testing' ? (
                                  <motion.div
                                    key="testing"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1, rotate: 360 }}
                                    transition={{ rotate: { repeat: Infinity, duration: 0.8, ease: 'linear' }, scale: { duration: 0.15 } }}
                                    className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent shrink-0"
                                  />
                                ) : mResult === 'ok' ? (
                                  <motion.div key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }}
                                    className="w-5 h-5 rounded-full bg-[#0d2b1f] border border-[#34d399] flex items-center justify-center shrink-0">
                                    <Check size={11} className="text-[#34d399]" />
                                  </motion.div>
                                ) : mResult === 'fail' ? (
                                  <motion.div key="fail" initial={{ scale: 0 }} animate={{ scale: 1 }}
                                    className="w-5 h-5 rounded-full bg-[#2e0f0f] border border-[#fb7185] flex items-center justify-center shrink-0">
                                    <X size={11} className="text-[#fb7185]" />
                                  </motion.div>
                                ) : m.verified ? (
                                  <div key="verified" className="w-5 h-5 rounded-full bg-[#0d2b1f] border border-[#34d399] flex items-center justify-center shrink-0">
                                    <Check size={11} className="text-[#34d399]" />
                                  </div>
                                ) : (
                                  <div key="unverified" className="w-5 h-5 rounded-full bg-[#1a1a0d] border border-[#fbbf24] flex items-center justify-center shrink-0">
                                    <Zap size={10} className="text-[#fbbf24]" />
                                  </div>
                                )}
                              </AnimatePresence>
                              <span className="flex-1 text-sm text-text-primary font-mono truncate">{m.id}</span>
                              {/* Test timing hint */}
                              {mResult === 'ok' && (
                                <span className="text-[10px] text-[#34d399] shrink-0">通过</span>
                              )}
                              {mResult === 'fail' && (
                                <span className="text-[10px] text-[#fb7185] shrink-0">失败</span>
                              )}
                              <button
                                onClick={() => handleRemoveModel(m.id)}
                                className="text-text-subtle hover:text-text-muted transition-colors shrink-0 ml-1"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-text-dim text-sm">
                  请选择或添加提供商
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="h-11 border-t border-border flex items-center justify-between px-5 shrink-0 bg-[#0d0d0f]">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  className="relative w-9 h-5 rounded-full transition-colors cursor-pointer"
                  style={{ background: showUnverified ? '#4f46e5' : '#27272a' }}
                  onClick={() => setShowUnverified(!showUnverified)}
                >
                  <motion.div
                    animate={{ x: showUnverified ? 18 : 2 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
                  />
                </div>
                <span className="text-xs text-text-dim">显示未验证的模型</span>
              </label>
              <div className="flex items-center gap-1.5 text-xs text-text-subtle">
                <Lock size={11} />
                API 密钥存储在您的浏览器本地
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
