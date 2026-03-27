import { useState } from 'react'
import { Cpu, Bell, Palette, Database, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { Layout } from '../components/layout/Layout'
import { useAppStore } from '../store/useAppStore'

const TABS = [
  { id: 'general', label: '通用', icon: Palette },
  { id: 'review', label: '复习算法', icon: Bell },
  { id: 'ai', label: 'AI 配置', icon: Cpu },
  { id: 'data', label: '数据管理', icon: Database },
]

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general')
  const { openAIConfig } = useAppStore()

  return (
    <Layout title="设置">
      <div className="flex h-full">
        {/* Left nav */}
        <div className="w-52 border-r border-border p-3 flex flex-col gap-1 shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2.5 h-9 px-3 rounded-sm text-sm transition-colors text-left ${
                activeTab === id
                  ? 'bg-[#1e1b4b] text-primary'
                  : 'text-text-muted hover:bg-[#27272a] hover:text-text-secondary'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Right content */}
        <div className="flex-1 p-8 overflow-y-auto">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'review' && <ReviewSettings />}
            {activeTab === 'ai' && <AISettings onOpenConfig={openAIConfig} />}
            {activeTab === 'data' && <DataSettings />}
          </motion.div>
        </div>
      </div>
    </Layout>
  )
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-border last:border-0">
      <div className="flex-1">
        <div className="text-sm font-medium text-text-secondary">{label}</div>
        {description && <div className="text-xs text-text-dim mt-0.5">{description}</div>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [on, setOn] = useState(defaultChecked)
  return (
    <button
      onClick={() => setOn(!on)}
      className={`relative w-10 h-5 rounded-full transition-colors ${on ? 'bg-primary-btn' : 'bg-[#3f3f46]'}`}
    >
      <motion.div
        animate={{ x: on ? 22 : 2 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
      />
    </button>
  )
}

function GeneralSettings() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary mb-6">通用设置</h2>
      <div className="bg-surface-card border border-border rounded-lg px-4">
        <SettingRow label="深色模式" description="始终使用深色主题"><Toggle defaultChecked /></SettingRow>
        <SettingRow label="自动保存" description="输入后自动保存笔记"><Toggle defaultChecked /></SettingRow>
        <SettingRow label="快捷键提示" description="界面中显示快捷键提示"><Toggle defaultChecked /></SettingRow>
        <SettingRow label="界面语言">
          <select className="bg-[#27272a] border border-border rounded-sm text-sm text-text-secondary px-3 py-1.5 outline-none">
            <option>中文</option>
            <option>English</option>
          </select>
        </SettingRow>
      </div>
    </div>
  )
}

function ReviewSettings() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary mb-6">复习算法</h2>
      <div className="bg-surface-card border border-border rounded-lg px-4">
        <SettingRow label="间隔重复算法" description="使用 SM-2 算法计算复习间隔">
          <select className="bg-[#27272a] border border-border rounded-sm text-sm text-text-secondary px-3 py-1.5 outline-none">
            <option>SM-2</option>
            <option>FSRS</option>
          </select>
        </SettingRow>
        <SettingRow label="每日新卡上限" description="每天最多学习新卡片数量">
          <input type="number" defaultValue={20} className="w-20 bg-[#27272a] border border-border rounded-sm text-sm text-text-secondary px-3 py-1.5 outline-none text-center" />
        </SettingRow>
        <SettingRow label="每日复习上限" description="每天最多复习卡片数量">
          <input type="number" defaultValue={100} className="w-20 bg-[#27272a] border border-border rounded-sm text-sm text-text-secondary px-3 py-1.5 outline-none text-center" />
        </SettingRow>
        <SettingRow label="自动翻转" description="倒计时结束后自动翻转卡片"><Toggle /></SettingRow>
      </div>
    </div>
  )
}

function AISettings({ onOpenConfig }: { onOpenConfig: () => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary mb-6">AI 配置</h2>
      <div className="bg-surface-card border border-border rounded-lg px-4 mb-4">
        <SettingRow label="AI 自动分类" description="添加笔记时自动识别分类"><Toggle defaultChecked /></SettingRow>
        <SettingRow label="AI 生成例句" description="自动为新笔记生成例句"><Toggle defaultChecked /></SettingRow>
        <SettingRow label="AI 联想同义词" description="自动补充同义词和反义词"><Toggle /></SettingRow>
      </div>
      <button
        onClick={onOpenConfig}
        className="flex items-center gap-3 w-full p-4 bg-surface-card border border-border rounded-lg hover:border-primary transition-colors group"
      >
        <Cpu size={18} className="text-primary" />
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-text-secondary">AI 模型配置</div>
          <div className="text-xs text-text-dim">配置 OpenRouter、SiliconFlow 等提供商</div>
        </div>
        <ChevronRight size={15} className="text-text-dim group-hover:text-text-muted" />
      </button>
    </div>
  )
}

function DataSettings() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary mb-6">数据管理</h2>
      <div className="flex flex-col gap-3">
        <div className="bg-surface-card border border-border rounded-lg p-4">
          <div className="text-sm font-medium text-text-secondary mb-1">导出数据</div>
          <div className="text-xs text-text-dim mb-3">将所有笔记导出为 JSON 或 CSV 格式</div>
          <div className="flex gap-2">
            <button className="h-8 px-3 text-xs border border-border rounded-sm text-text-muted hover:bg-[#27272a] transition-colors">导出 JSON</button>
            <button className="h-8 px-3 text-xs border border-border rounded-sm text-text-muted hover:bg-[#27272a] transition-colors">导出 CSV</button>
          </div>
        </div>
        <div className="bg-surface-card border border-border rounded-lg p-4">
          <div className="text-sm font-medium text-text-secondary mb-1">导入数据</div>
          <div className="text-xs text-text-dim mb-3">从 Anki、CSV 或 JSON 文件导入</div>
          <button className="h-8 px-3 text-xs bg-primary-btn hover:bg-[#4338ca] rounded-sm text-white transition-colors">选择文件</button>
        </div>
        <div className="bg-[#450a0a] border border-[#7f1d1d] rounded-lg p-4">
          <div className="text-sm font-medium text-[#fb7185] mb-1">危险操作</div>
          <div className="text-xs text-[#fb7185]/70 mb-3">清空所有数据，此操作不可撤销</div>
          <button className="h-8 px-3 text-xs bg-[#7f1d1d] hover:bg-[#991b1b] rounded-sm text-[#fb7185] transition-colors">清空所有数据</button>
        </div>
      </div>
    </div>
  )
}
