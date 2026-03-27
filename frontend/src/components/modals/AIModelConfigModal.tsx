import { useState } from 'react'
import { X, Cpu, GitBranch, Zap, Sparkles, Brain, CheckCircle, Circle, Eye, EyeOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import { mockProviders, type Provider } from '../../data/mockData'

const PROVIDER_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'git-branch': GitBranch,
  'zap': Zap,
  'sparkles': Sparkles,
  'brain': Brain,
}

export function AIModelConfigModal() {
  const { showAIConfig, closeAIConfig } = useAppStore()
  const [providers, setProviders] = useState<Provider[]>(mockProviders)
  const [selected, setSelected] = useState(providers[1].id)
  const [showKey, setShowKey] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [apiKey, setApiKey] = useState('')

  const currentProvider = providers.find((p) => p.id === selected)!

  const handleTest = () => {
    setTestStatus('testing')
    setTimeout(() => {
      setTestStatus(apiKey.length > 5 ? 'ok' : 'fail')
      setTimeout(() => setTestStatus('idle'), 2000)
    }, 1200)
  }

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
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[1100px] h-[740px] bg-[#111113] border border-border rounded-2xl shadow-modal flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="h-16 border-b border-border flex items-center gap-3 px-6 shrink-0">
              <div className="w-9 h-9 bg-[#1e1e3a] rounded-lg flex items-center justify-center">
                <Cpu size={18} className="text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-base font-semibold text-text-primary">AI 模型配置</div>
                <div className="text-xs text-text-dim">配置多个 AI 提供商和模型</div>
              </div>
              <button
                onClick={closeAIConfig}
                className="w-8 h-8 bg-[#27272a] rounded-sm flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-[#3f3f46] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 min-h-0">
              {/* Left provider list */}
              <div className="w-60 border-r border-border flex flex-col p-4 gap-1 shrink-0">
                <div className="text-[11px] font-semibold text-text-subtle uppercase tracking-wide mb-2">提供商</div>
                {providers.map((p) => {
                  const Icon = PROVIDER_ICONS[p.icon] ?? Sparkles
                  const isSelected = selected === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p.id)}
                      className={`flex items-center gap-2.5 h-11 px-3 rounded-md transition-all ${
                        isSelected ? 'bg-[#1c1c20] border border-border' : 'hover:bg-[#1a1a1e]'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-sm flex items-center justify-center shrink-0"
                        style={{ background: p.color + '22', color: p.color }}
                      >
                        <Icon size={14} className="text-inherit" />
                      </div>
                      <span className={`flex-1 text-left text-[13px] ${isSelected ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
                        {p.name}
                      </span>
                      {p.connected
                        ? <CheckCircle size={14} className="text-[#34d399] shrink-0" />
                        : <Circle size={14} className="text-border-strong shrink-0" />
                      }
                    </button>
                  )
                })}
              </div>

              {/* Right config panel */}
              <motion.div
                key={selected}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 p-6 overflow-y-auto flex flex-col gap-5"
              >
                <div>
                  <h3 className="text-base font-semibold text-text-primary">{currentProvider.name}</h3>
                  <p className="text-xs text-text-dim mt-0.5">配置 {currentProvider.name} 的 API 密钥和模型</p>
                </div>

                {/* API Key */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-text-secondary">API Key</label>
                  <div className="flex items-center gap-2 h-9 bg-[#1a1a1e] border border-border rounded-sm px-3">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-subtle outline-none font-mono"
                    />
                    <button onClick={() => setShowKey(!showKey)} className="text-text-dim hover:text-text-muted transition-colors">
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Models */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-text-secondary">可用模型</label>
                  <div className="flex flex-col gap-1.5">
                    {currentProvider.models.map((m) => (
                      <button
                        key={m}
                        onClick={() => setProviders((prev) =>
                          prev.map((p) => p.id === selected ? { ...p, selectedModel: m } : p)
                        )}
                        className={`flex items-center gap-3 h-10 px-3 rounded-md border transition-all text-left ${
                          currentProvider.selectedModel === m
                            ? 'border-primary bg-[#1e1e3a] text-text-primary'
                            : 'border-border text-text-muted hover:border-border-strong hover:bg-[#1a1a1e]'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                          currentProvider.selectedModel === m ? 'border-primary' : 'border-border-strong'
                        }`}>
                          {currentProvider.selectedModel === m && (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                        </div>
                        <span className="text-sm font-mono">{m}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Test connection */}
                <div className="flex items-center gap-3 pt-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleTest}
                    disabled={testStatus === 'testing'}
                    className={`h-9 px-4 rounded-sm text-sm font-medium transition-all ${
                      testStatus === 'ok' ? 'bg-[#064e3b] text-[#34d399]' :
                      testStatus === 'fail' ? 'bg-[#450a0a] text-[#fb7185]' :
                      'bg-primary-btn hover:bg-[#4338ca] text-white'
                    }`}
                  >
                    {testStatus === 'testing' ? '测试中...' :
                     testStatus === 'ok' ? '✓ 连接成功' :
                     testStatus === 'fail' ? '✗ 连接失败' :
                     '测试连接'}
                  </motion.button>
                  <button className="h-9 px-4 border border-border rounded-sm text-sm text-text-muted hover:bg-[#27272a] transition-colors">
                    保存配置
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
