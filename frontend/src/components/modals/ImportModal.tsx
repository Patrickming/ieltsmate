import { useState, useRef } from 'react'
import { X, Upload, FileText, Notebook, Sparkles, HelpCircle, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'

type ImportType = '杂笔记' | '写作'

export function ImportModal() {
  const { showImport, closeImport } = useAppStore()
  const [importType, setImportType] = useState<ImportType>('杂笔记')
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [showTip, setShowTip] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setDone(false)
  }

  const handleImport = () => {
    if (!file) return
    setImporting(true)
    setTimeout(() => {
      setImporting(false)
      setDone(true)
    }, 1800)
  }

  const handleClose = () => {
    setFile(null)
    setDone(false)
    setImporting(false)
    closeImport()
  }

  return (
    <AnimatePresence>
      {showImport && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={handleClose}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[480px] bg-[#1c1c20] border border-[#2a2a35] rounded-xl shadow-modal"
          >
            <div className="p-6 flex flex-col gap-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-text-primary">导入数据</span>
                  {/* AI tooltip */}
                  <div className="relative">
                    <button
                      onMouseEnter={() => setShowTip(true)}
                      onMouseLeave={() => setShowTip(false)}
                      className="text-text-subtle hover:text-text-dim transition-colors"
                    >
                      <HelpCircle size={14} />
                    </button>
                    <AnimatePresence>
                      {showTip && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="absolute left-0 top-6 w-64 bg-[#1a1a28] border border-border rounded-md p-3 text-xs text-text-muted z-10 shadow-modal"
                        >
                          <div className="flex items-center gap-1.5 mb-1.5 text-primary">
                            <Sparkles size={10} />
                            <span className="font-semibold">AI 辅助导入</span>
                          </div>
                          AI 会自动识别笔记格式，提取词条、释义和分类信息，兼容杂乱或非标准格式的文本文件。
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <button onClick={handleClose} className="text-text-dim hover:text-text-muted transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Type selector */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-text-dim">选择导入类型</span>
                <div className="grid grid-cols-2 gap-3">
                  {(['杂笔记', '写作'] as ImportType[]).map((t) => {
                    const Icon = t === '杂笔记' ? Notebook : FileText
                    const isSelected = importType === t
                    return (
                      <button
                        key={t}
                        onClick={() => setImportType(t)}
                        className={`flex items-center gap-3 p-3.5 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-primary bg-[#1e1b4b]'
                            : 'border-border bg-[#141420] hover:border-border-strong'
                        }`}
                      >
                        <Icon size={18} className={isSelected ? 'text-primary' : 'text-text-dim'} />
                        <div className="text-left">
                          <div className={`text-sm font-medium ${isSelected ? 'text-text-primary' : 'text-text-muted'}`}>{t}</div>
                          <div className="text-[10px] text-text-subtle mt-0.5">
                            {t === '杂笔记' ? '口语/短语/单词等' : 'Markdown 写作文件'}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* File picker */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-text-dim">选择文件</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept={importType === '写作' ? '.md,.markdown,.txt' : '.txt,.csv,.json,.md'}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className={`flex items-center gap-3 h-20 border-2 border-dashed rounded-lg px-4 transition-all ${
                    file
                      ? 'border-primary/50 bg-[#1e1b4b]/30'
                      : 'border-border hover:border-border-strong'
                  }`}
                >
                  <Upload size={20} className={file ? 'text-primary' : 'text-text-dim'} />
                  <div className="text-left">
                    {file ? (
                      <>
                        <div className="text-sm font-medium text-text-primary">{file.name}</div>
                        <div className="text-xs text-text-dim mt-0.5">{(file.size / 1024).toFixed(1)} KB</div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm text-text-muted">点击选择文件</div>
                        <div className="text-xs text-text-subtle mt-0.5">
                          支持 {importType === '写作' ? '.md .markdown .txt' : '.txt .csv .json .md'}
                        </div>
                      </>
                    )}
                  </div>
                </button>
              </div>

              {/* AI notice */}
              <div className="flex items-start gap-2.5 bg-[#141428] border border-[#3a3a5a] rounded-md px-3.5 py-3">
                <Sparkles size={13} className="text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-text-muted leading-relaxed">
                  导入时 AI 将自动识别并整理笔记格式，兼容乱序、混合格式的文本，准确率更高。
                  {importType === '写作' && ' 写作文件将解析本地路径以正确显示图片。'}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5">
                <button
                  onClick={handleClose}
                  className="h-9 px-5 border border-border rounded-md text-[13px] text-text-dim hover:bg-[#27272a] transition-colors"
                >
                  取消
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleImport}
                  disabled={!file || importing || done}
                  className={`h-9 px-5 rounded-md text-[13px] font-medium transition-all flex items-center gap-2 ${
                    done
                      ? 'bg-[#064e3b] text-[#34d399]'
                      : 'bg-primary-btn hover:bg-[#4338ca] text-white disabled:opacity-50'
                  }`}
                >
                  {done ? (
                    <><CheckCircle2 size={14} />导入完成</>
                  ) : importing ? (
                    <><motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    ><Upload size={14} /></motion.div>AI 解析中...</>
                  ) : (
                    <>开始导入</>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
