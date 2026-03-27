import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Volume2, Plus, Check, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layout } from '../components/layout/Layout'
import { Badge } from '../components/ui/Badge'
import { useAppStore } from '../store/useAppStore'
import { CATEGORY_BAR, type Category } from '../data/mockData'
import type { Note } from '../data/mockData'

// Per-category card back content strategy (per prompt)
function getCardType(category: Category): 'word-speech' | 'phrase' | 'synonym' | 'sentence' | 'spelling' {
  if (category === '口语' || category === '单词') return 'word-speech'
  if (category === '短语') return 'phrase'
  if (category === '同义替换') return 'synonym'
  if (category === '句子') return 'sentence'
  if (category === '拼写') return 'spelling'
  return 'word-speech'
}

function CardFront({ note, cardType }: { note: Note; cardType: ReturnType<typeof getCardType> }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-8">
      <Badge category={note.category} size="md" />
      {cardType === 'spelling' ? (
        <div className="text-center">
          <p className="text-lg text-text-muted mb-3">请拼出这个单词</p>
          <p className="text-3xl font-bold text-text-primary">{note.translation}</p>
          {note.content && (
            <p className="text-text-dim text-base mt-2">
              首字母: <span className="text-primary font-semibold">{note.content[0].toUpperCase()}</span>
            </p>
          )}
        </div>
      ) : (
        <h2 className="text-[2.5rem] font-bold text-text-primary text-center leading-tight">
          {note.content}
        </h2>
      )}
      <p className="text-sm text-text-dim">点击卡片或按空格键翻转</p>
    </div>
  )
}

function CardBack({ note, savedSyn, savedAnt, onSaveSyn, onSaveAnt }: {
  note: Note
  savedSyn: string[]
  savedAnt: string[]
  onSaveSyn: (s: string) => void
  onSaveAnt: (s: string) => void
}) {
  const barColor = CATEGORY_BAR[note.category] ?? '#818cf8'

  return (
    <div className="flex flex-col gap-4 p-7 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <Badge category={note.category} size="md" />
        <span className="text-xs text-text-dim">已翻转</span>
      </div>

      {/* Phonetic */}
      {note.phonetic && (
        <div className="flex items-center gap-2.5 bg-[#141420] border border-[#27272a] rounded-md px-3 py-2.5 w-fit">
          <Volume2 size={14} className="text-primary" />
          <span className="text-sm text-[#a5b4fc]">{note.phonetic}</span>
        </div>
      )}

      {/* Meaning */}
      <div>
        <div className="text-[11px] font-semibold text-text-dim mb-1">中文意思</div>
        <p className="text-base text-text-primary">{note.translation}</p>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Synonyms — for all types */}
      {note.synonyms && note.synonyms.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-text-muted mb-2">🔄 同义短语</div>
          <div className="flex flex-wrap gap-2">
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
                  <span className="text-sm text-text-primary">{syn}</span>
                  <button onClick={() => onSaveSyn(syn)} className="flex items-center gap-1" style={{ color: saved ? '#34d399' : '#818cf8' }}>
                    {saved ? <Check size={9} /> : <Plus size={9} />}
                    <span className="text-[10px]">{saved ? '✓ 已存入' : '存入'}</span>
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
          <div className="text-xs font-semibold text-text-muted mb-2">🔀 反义短语</div>
          <div className="flex flex-wrap gap-2">
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
                  <span className="text-sm text-text-primary">{ant}</span>
                  <button onClick={() => onSaveAnt(ant)} className="flex items-center gap-1" style={{ color: saved ? '#34d399' : '#818cf8' }}>
                    {saved ? <Check size={9} /> : <Plus size={9} />}
                    <span className="text-[10px]">{saved ? '✓ 已存入' : '存入'}</span>
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
          className="rounded-lg border px-4 py-3"
          style={{ background: '#1e1a2e', borderColor: barColor + '40' }}
        >
          <div className="flex items-center gap-1.5 mb-1.5 text-primary">
            <Sparkles size={11} />
            <span className="text-[11px] font-semibold">记忆技巧</span>
          </div>
          <p className="text-xs text-[#c4b5fd] leading-relaxed">{note.memoryTip}</p>
        </div>
      )}

      {/* Example */}
      {note.example && (
        <div>
          <div className="h-px bg-border mb-3" />
          <div className="text-xs font-semibold text-text-muted mb-2">💬 例句</div>
          <div className="bg-[#141420] border border-[#27272a] rounded-md px-4 py-3">
            <p className="text-sm text-text-secondary italic leading-relaxed">"{note.example}"</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReviewCards() {
  const navigate = useNavigate()
  const { reviewSession, nextCard, rateCard } = useAppStore()
  const [flipped, setFlipped] = useState(false)
  const [savedSyn, setSavedSyn] = useState<string[]>([])
  const [savedAnt, setSavedAnt] = useState<string[]>([])
  const [exiting, setExiting] = useState(false)

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
    if (exiting) return
    rateCard(card.id, rating)
    setExiting(true)
    setTimeout(() => {
      if (current + 1 >= total) {
        navigate('/review/summary')
      } else {
        setFlipped(false)
        setSavedSyn([])
        setSavedAnt([])
        setExiting(false)
        nextCard()
      }
    }, 220)
  }

  return (
    <Layout title="复习">
      {/* Progress topbar */}
      <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-surface-bg shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-text-primary">{current + 1} / {total}</span>
          <div className="w-48 h-1.5 bg-[#27272a] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
        <span className="text-xs text-text-dim">空格键翻转卡片</span>
      </div>

      {/* Card area */}
      <div className="flex flex-col items-center justify-between h-[calc(100vh-112px)] px-12 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id + String(exiting)}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="w-full max-w-[920px] flex-1"
          >
            {/* Flip container */}
            <div
              className="perspective w-full h-full cursor-pointer"
              onClick={() => !exiting && setFlipped((f) => !f)}
            >
              <motion.div
                className="preserve-3d relative w-full h-full"
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                style={{ minHeight: '360px' }}
              >
                {/* Front */}
                <div
                  className="backface-hidden absolute inset-0 bg-surface-card border border-border rounded-2xl overflow-hidden"
                  style={{ borderTopColor: barColor, borderTopWidth: 3 }}
                >
                  <CardFront note={card} cardType={cardType} />
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
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Rating buttons */}
        <AnimatePresence>
          {flipped && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex items-center gap-6 pt-4 pb-2"
            >
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => handleRate('again')}
                className="flex items-center gap-2 h-12 px-8 rounded-xl bg-[#2e1520] border border-[#fb7185]/40 text-[#fb7185] text-base font-semibold hover:bg-[#450a0a] transition-colors"
              >
                😞 不记得
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => handleRate('easy')}
                className="flex items-center gap-2 h-12 px-8 rounded-xl bg-[#1a2e22] border border-[#34d399]/40 text-[#34d399] text-base font-semibold hover:bg-[#064e3b] transition-colors"
              >
                😊 记得
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  )
}
