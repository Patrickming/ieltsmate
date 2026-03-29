import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Volume2, Plus, Check, Sparkles, HelpCircle, LogOut } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layout } from '../components/layout/Layout'
import { Badge } from '../components/ui/Badge'
import { StrokeButton } from '../components/ui/StrokeButton'
import { useAppStore } from '../store/useAppStore'
import { CATEGORY_BAR, type Category } from '../data/mockData'
import type { Note } from '../data/mockData'

function getCardType(category: Category): 'word-speech' | 'phrase' | 'synonym' | 'sentence' | 'spelling' {
  if (category === '口语' || category === '单词') return 'word-speech'
  if (category === '短语') return 'phrase'
  if (category === '同义替换') return 'synonym'
  if (category === '句子') return 'sentence'
  if (category === '拼写') return 'spelling'
  return 'word-speech'
}

// AI tooltip component
function AITip({ label, tip }: { label: string; tip: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex items-center gap-1.5 relative">
      <span className="text-sm font-semibold text-text-muted">{label}</span>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-text-subtle hover:text-text-dim transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <HelpCircle size={12} />
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute left-0 top-6 w-60 bg-[#1a1a28] border border-border rounded-md p-3 text-[11px] text-text-muted z-20 shadow-modal pointer-events-none"
          >
            <div className="flex items-center gap-1 mb-1.5 text-primary">
              <Sparkles size={9} />
              <span className="font-semibold">AI 操作说明</span>
            </div>
            {tip}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CardFront({ note, cardType, answer, onAnswerChange }: {
  note: Note
  cardType: ReturnType<typeof getCardType>
  answer?: string
  onAnswerChange?: (v: string) => void
}) {
  // Generate placeholder like "c___" for a word starting with 'c'
  const spellingHint = note.content
    ? `${note.content[0].toLowerCase()}${'_'.repeat(Math.max(0, note.content.length - 1))}`
    : ''

  // Parse translation into structured lines for dictionary display
  const translationLines = note.translation
    ? note.translation.split(/[；;]/).map(s => s.trim()).filter(Boolean)
    : []

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-8">
      <Badge category={note.category} size="md" />
      {cardType === 'spelling' ? (
        <div className="flex flex-col items-center gap-4 w-full max-w-[520px]">
          <p className="text-xl font-semibold text-text-muted">请拼出这个单词</p>
          {/* Dictionary-style definitions */}
          <div className="w-full bg-[#141420] border border-[#27272a] rounded-xl px-5 py-4 text-left">
            {translationLines.map((line, i) => (
              <p key={i} className="text-[15px] text-text-secondary leading-relaxed">
                {line}
              </p>
            ))}
          </div>
          {/* Answer input */}
          <input
            value={answer ?? ''}
            onChange={e => onAnswerChange?.(e.target.value)}
            placeholder={spellingHint}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            className="h-12 w-72 bg-[#18181b] border border-border rounded-xl px-4 text-[18px] text-center text-text-primary outline-none focus:border-primary/60 transition-colors font-mono placeholder-text-subtle tracking-widest"
          />
        </div>
      ) : (
        <h2 className="text-[2.8rem] font-bold text-text-primary text-center leading-tight">
          {note.content}
        </h2>
      )}
      <p className="text-base text-text-dim">
        {cardType === 'spelling' ? '输入答案后点击卡片或按空格键翻转查看' : '点击卡片或按空格键翻转'}
      </p>
    </div>
  )
}

function CardBack({ note, savedSyn, savedAnt, onSaveSyn, onSaveAnt, spellingAnswer }: {
  note: Note
  savedSyn: string[]
  savedAnt: string[]
  onSaveSyn: (s: string) => void
  onSaveAnt: (s: string) => void
  spellingAnswer?: string
}) {
  const barColor = CATEGORY_BAR[note.category] ?? '#818cf8'
  const isSpelling = note.category === '拼写'
  const spellingCorrect = isSpelling && spellingAnswer
    ? spellingAnswer.trim().toLowerCase() === note.content.toLowerCase()
    : null

  return (
    <div className="flex flex-col gap-5 p-7 overflow-y-auto h-full" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <Badge category={note.category} size="md" />
        <span className="text-sm text-text-dim">已翻转</span>
      </div>

      {/* Spelling answer comparison */}
      {isSpelling && spellingAnswer && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{
            background: spellingCorrect ? '#0d2b1f' : '#2e0f0f',
            borderColor: spellingCorrect ? '#34d399' : '#fb7185',
          }}
        >
          <span className="text-2xl">{spellingCorrect ? '✓' : '✗'}</span>
          <div>
            <p className="text-sm text-text-dim mb-0.5">你的答案</p>
            <p className="text-[17px] font-mono font-semibold" style={{ color: spellingCorrect ? '#34d399' : '#fb7185' }}>
              {spellingAnswer}
            </p>
          </div>
          {!spellingCorrect && (
            <>
              <div className="w-px h-10 bg-border mx-1" />
              <div>
                <p className="text-sm text-text-dim mb-0.5">正确答案</p>
                <p className="text-[17px] font-mono font-semibold text-[#34d399]">{note.content}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Phonetic */}
      {note.phonetic && (
        <div className="flex items-center gap-2.5 bg-[#141420] border border-[#27272a] rounded-md px-3.5 py-3 w-fit">
          <Volume2 size={16} className="text-primary" />
          <span className="text-[16px] text-[#a5b4fc]">{note.phonetic}</span>
        </div>
      )}

      {/* Meaning */}
      <div>
        <div className="text-sm font-semibold text-text-dim mb-1.5">中文意思</div>
        <p className="text-[17px] text-text-primary leading-snug">{note.translation}</p>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Synonyms */}
      {note.synonyms && note.synonyms.length > 0 && (
        <div>
          <AITip
            label="🔄 同义短语"
            tip="AI 基于原词实时生成，点击「存入」可保存到知识库与原词关联"
          />
          <div className="flex flex-wrap gap-2 mt-2.5">
            {note.synonyms.map((syn) => {
              const saved = savedSyn.includes(syn)
              return (
                <div
                  key={syn}
                  className="flex flex-col gap-1.5 px-3 py-2.5 rounded-md border"
                  style={saved
                    ? { background: '#1a2e22', borderColor: '#34d399' }
                    : { background: '#1a1a28', borderColor: '#27272a' }
                  }
                >
                  <span className="text-[15px] text-text-primary">{syn}</span>
                  <button onClick={() => onSaveSyn(syn)} className="flex items-center gap-1" style={{ color: saved ? '#34d399' : '#818cf8' }}>
                    {saved ? <Check size={10} /> : <Plus size={10} />}
                    <span className="text-[11px]">{saved ? '✓ 已存入' : '存入'}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Antonyms */}
      {note.antonyms && note.antonyms.length > 0 && (
        <div>
          <AITip
            label="🔀 反义短语"
            tip="AI 生成的语义对立词/短语，供扩展记忆，点击「存入」可关联到知识库"
          />
          <div className="flex flex-wrap gap-2 mt-2.5">
            {note.antonyms.map((ant) => {
              const saved = savedAnt.includes(ant)
              return (
                <div
                  key={ant}
                  className="flex flex-col gap-1.5 px-3 py-2.5 rounded-md border"
                  style={saved
                    ? { background: '#1a2e22', borderColor: '#34d399' }
                    : { background: '#1a1a28', borderColor: '#27272a' }
                  }
                >
                  <span className="text-[15px] text-text-primary">{ant}</span>
                  <button onClick={() => onSaveAnt(ant)} className="flex items-center gap-1" style={{ color: saved ? '#34d399' : '#818cf8' }}>
                    {saved ? <Check size={10} /> : <Plus size={10} />}
                    <span className="text-[11px]">{saved ? '✓ 已存入' : '存入'}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Memory tip */}
      {note.memoryTip && (
        <div
          className="rounded-lg border px-4 py-3.5"
          style={{ background: '#1e1a2e', borderColor: barColor + '40' }}
        >
          <AITip
            label="✨ 记忆技巧"
            tip="AI 基于词源/联想生成记忆辅助，每次复习可能不同，帮助加深印象"
          />
          <p className="text-[13px] text-[#c4b5fd] leading-relaxed mt-2">{note.memoryTip}</p>
        </div>
      )}

      {/* Example */}
      {note.example && (
        <div>
          <div className="h-px bg-border mb-4" />
          <div className="text-sm font-semibold text-text-muted mb-2">💬 例句</div>
          <div className="bg-[#141420] border border-[#27272a] rounded-md px-4 py-3.5">
            <p className="text-[14px] text-text-secondary italic leading-relaxed">"{note.example}"</p>
          </div>
        </div>
      )}
    </div>
  )
}

/** Pill-style favorite toggle used inside review session */
function ReviewFavButton({ noteId }: { noteId: string }) {
  const { favorites, toggleFavorite } = useAppStore()
  const isFav = favorites.includes(noteId)
  const color = isFav ? '#ef4444' : '#f472b6'

  return (
    <button
      type="button"
      onClick={() => toggleFavorite(noteId)}
      className="pill-btn"
      style={{
        ['--btn-color' as string]: color,
        ['--btn-shadow' as string]: `${color}70`,
      } as React.CSSProperties}
    >
      {isFav ? '♥ 已收藏' : '♡ 收藏'}
    </button>
  )
}

export default function ReviewCards() {
  const navigate = useNavigate()
  const { reviewSession, nextCard, rateCard, endReview } = useAppStore()
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [savedSyn, setSavedSyn] = useState<string[]>([])
  const [savedAnt, setSavedAnt] = useState<string[]>([])
  const [spellingAnswer, setSpellingAnswer] = useState('')
  // No exiting state — use flip-back + setTimeout instead

  const session = reviewSession
  const card = session?.cards[session.current]
  const total = session?.cards.length ?? 0
  const current = session?.current ?? 0
  const progress = total > 0 ? ((current + 1) / total) * 100 : 0

  useEffect(() => {
    if (!session) navigate('/review')
  }, [session, navigate])

  // Spacebar flip
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        setFlipped((f) => !f)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!session || !card) return null

  const cardType = getCardType(card.category as Category)
  const barColor = CATEGORY_BAR[card.category] ?? '#818cf8'

  const handleRate = (rating: 'easy' | 'again') => {
    rateCard(card.id, rating)
    // First flip back to front face, then transition to next card
    setFlipped(false)
    setSavedSyn([])
    setSavedAnt([])
    setSpellingAnswer('')
    setTimeout(() => {
      if (current + 1 >= total) {
        navigate('/review/summary')
      } else {
        nextCard() // key change triggers AnimatePresence — card is already front-facing, no rotation visible
      }
    }, 300)
  }

  return (
    <Layout title="复习">
      {/* Progress topbar */}
      <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-surface-bg shrink-0 gap-4">
        {/* Left: exit + progress */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-text-dim hover:text-text-muted hover:border-border-strong hover:bg-[#27272a]/60 transition-all text-[12px] font-medium"
          >
            <LogOut size={12} />
            退出
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-text-primary tabular-nums">{current + 1} / {total}</span>
            <div className="w-40 h-1.5 bg-[#27272a] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </div>
        <span className="text-xs text-text-dim">空格键翻转卡片</span>
      </div>

      {/* Exit confirm dialog */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowExitConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-80 rounded-2xl border p-6 flex flex-col gap-4"
              style={{ background: '#1c1c20', borderColor: '#3f3f46', boxShadow: '0 24px 48px rgba(0,0,0,0.6)' }}
            >
              <div>
                <div className="text-base font-bold text-text-primary mb-1">退出复习？</div>
                <div className="text-sm text-text-dim">当前进度将不会保存，已评分的记录仍然有效。</div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowExitConfirm(false)}
                  className="h-9 px-4 rounded-lg border border-border text-sm text-text-muted hover:border-border-strong hover:bg-[#27272a]/60 transition-all"
                >
                  继续复习
                </button>
                <button
                  type="button"
                  onClick={() => { endReview(); navigate('/review') }}
                  className="h-9 px-4 rounded-lg text-sm font-semibold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}
                >
                  确认退出
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card area */}
      <div className="flex flex-col items-center gap-6 px-12 py-8 h-[calc(100vh-112px)]">
        {/* Card wrapper */}
        <div className="w-full max-w-[920px] flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={card.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="w-full h-full"
            >
              {/* Flip container */}
              <div
                className="perspective w-full h-full cursor-pointer"
                onClick={() => setFlipped((f) => !f)}
              >
                <motion.div
                  className="preserve-3d relative w-full h-full"
                  animate={{ rotateY: flipped ? 180 : 0 }}
                  transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                  style={{ minHeight: '360px' }}
                >
                  {/* Front */}
                  <div
                    className="backface-hidden absolute inset-0 bg-surface-card border border-border rounded-2xl overflow-hidden"
                    style={{ borderTopColor: barColor, borderTopWidth: 3 }}
                  >
                    <CardFront
                      note={card}
                      cardType={cardType}
                      answer={spellingAnswer}
                      onAnswerChange={setSpellingAnswer}
                    />
                  </div>

                  {/* Back */}
                  <div
                    className="backface-hidden absolute inset-0 bg-surface-card border border-border rounded-2xl overflow-hidden rotate-y-180"
                    style={{ borderTopColor: barColor, borderTopWidth: 3 }}
                  >
                    <CardBack
                      note={card}
                      savedSyn={savedSyn}
                      savedAnt={savedAnt}
                      onSaveSyn={(s) => setSavedSyn((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])}
                      onSaveAnt={(s) => setSavedAnt((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])}
                      spellingAnswer={spellingAnswer}
                    />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Rating buttons + favorite */}
        <div className="shrink-0 pb-6 flex items-center justify-center gap-10">
          <AnimatePresence>
            {flipped && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-10"
              >
                <StrokeButton color="#fb7185" onClick={() => handleRate('again')}>
                  😞 不记得
                </StrokeButton>
                <StrokeButton color="#34d399" onClick={() => handleRate('easy')}>
                  😊 记得
                </StrokeButton>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Favorite stroke toggle — always visible */}
          <ReviewFavButton noteId={card.id} />
        </div>
      </div>
    </Layout>
  )
}
