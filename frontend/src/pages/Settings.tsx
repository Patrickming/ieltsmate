import { useState } from 'react'
import { Plus, Trash2, Pencil, ChevronDown, Database, Download, Upload } from 'lucide-react'
import { Layout } from '../components/layout/Layout'
import { useAppStore } from '../store/useAppStore'
import { mockProviders } from '../data/mockData'

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-lg font-semibold text-text-primary">{children}</h2>
}

export default function Settings() {
  const { openAIConfig } = useAppStore()
  const [providers] = useState(mockProviders)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [dailyNew, setDailyNew] = useState(20)
  const [dailyReview, setDailyReview] = useState(100)

  const MODELS = ['分类识别', '复习联想', 'AI 助手']

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

          {/* Model list */}
          <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
            {providers.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-4 px-5 py-4 ${i < providers.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary">{p.name}</div>
                  <div className="text-xs text-text-dim mt-0.5">
                    openai-compatible · {p.apiKey ? `${p.apiKey.slice(0, 4)}****${p.apiKey.slice(-4)}` : 'sk-****'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ background: p.connected ? '#064e3b' : '#27272a', color: p.connected ? '#34d399' : '#71717a' }}
                  >
                    {p.connected ? '已连接' : '未连接'}
                  </div>
                  <button className="h-7 px-2.5 border border-border rounded-sm text-xs text-text-muted hover:bg-[#27272a] transition-colors flex items-center gap-1">
                    <Pencil size={11} />编辑
                  </button>
                  <button className="h-7 px-2.5 bg-[#2e1520] border border-[#fb7185]/30 rounded-sm text-xs text-[#fb7185] hover:bg-[#450a0a] transition-colors flex items-center gap-1">
                    <Trash2 size={11} />删除
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Default model assignment */}
          <div>
            <div className="text-sm font-medium text-text-muted mb-3">默认模型分配</div>
            <div className="grid grid-cols-3 gap-3">
              {MODELS.map((m) => (
                <div key={m} className="flex flex-col gap-1.5">
                  <span className="text-xs text-text-dim">{m}</span>
                  <button className="flex items-center justify-between h-8 bg-[#232328] border border-border rounded-sm px-3 text-xs text-text-muted hover:border-border-strong transition-colors">
                    <span>{providers[0]?.selectedModel?.split('/').pop() ?? 'GLM-Z1-Flash'}</span>
                    <ChevronDown size={11} className="text-text-subtle" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Section 2: 学习偏好 */}
        <section className="flex flex-col gap-5">
          <SectionTitle>学习偏好</SectionTitle>
          <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
            {/* Daily new */}
            <div className="flex items-center px-5 py-4 border-b border-border">
              <div className="flex-1">
                <div className="text-sm font-medium text-text-secondary">每日新卡片上限</div>
                <div className="text-xs text-text-dim mt-0.5">每天最多学习的新卡片数量</div>
              </div>
              <input
                type="number"
                value={dailyNew}
                onChange={(e) => setDailyNew(Number(e.target.value))}
                className="w-20 h-8 bg-[#232328] border border-border rounded-md text-sm text-text-primary text-center outline-none focus:border-primary transition-colors"
              />
            </div>
            {/* Daily review */}
            <div className="flex items-center px-5 py-4 border-b border-border">
              <div className="flex-1">
                <div className="text-sm font-medium text-text-secondary">每日复习上限</div>
                <div className="text-xs text-text-dim mt-0.5">每天最多复习的卡片数量</div>
              </div>
              <input
                type="number"
                value={dailyReview}
                onChange={(e) => setDailyReview(Number(e.target.value))}
                className="w-20 h-8 bg-[#232328] border border-border rounded-md text-sm text-text-primary text-center outline-none focus:border-primary transition-colors"
              />
            </div>
            {/* Theme */}
            <div className="flex items-center px-5 py-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-text-secondary">界面主题</div>
                <div className="text-xs text-text-dim mt-0.5">选择浅色或深色主题</div>
              </div>
              <div className="flex items-center bg-[#232328] rounded-lg p-0.5">
                {(['dark', 'light'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      theme === t
                        ? 'bg-primary-btn text-white'
                        : 'text-text-dim hover:text-text-muted'
                    }`}
                  >
                    {t === 'dark' ? '暗色' : '亮色'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Section 3: 数据管理 */}
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
                <button className="flex items-center gap-1.5 h-8 px-3 text-xs border border-border rounded-sm text-text-muted hover:bg-[#27272a] transition-colors">
                  <Download size={12} />JSON
                </button>
                <button className="flex items-center gap-1.5 h-8 px-3 text-xs border border-border rounded-sm text-text-muted hover:bg-[#27272a] transition-colors">
                  <Download size={12} />CSV
                </button>
              </div>
            </div>
            <div className="bg-surface-card border border-border rounded-xl p-5">
              <div className="text-sm font-medium text-text-secondary mb-1">导入数据</div>
              <div className="text-xs text-text-dim mb-4">从文件导入，AI 辅助解析</div>
              <button className="flex items-center gap-1.5 h-8 px-3 text-xs bg-primary-btn hover:bg-[#4338ca] rounded-sm text-white transition-colors">
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
