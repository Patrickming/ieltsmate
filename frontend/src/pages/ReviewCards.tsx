import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Volume2, Plus, Check, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layout } from '../components/layout/Layout'
import { Badge } from '../components/ui/Badge'
import { useAppStore } from '../store/useAppStore'
import { CATEGORY_BAR } from '../data/mockData'

export default function ReviewCards() {
  const navigate = useNavigate()
  const { reviewSession, nextCard, rateCard } = useAppStore()
  const [flipped, setFlipped] = useState(false)
  const [direction, setDirection] = useState(1)

  const session = reviewSession
  const card = session?.cards[session.current]
  const total = session?.cards.length ?? 0
  const current = session?.current ?? 0
  const progress = total > 0 ? (current / total) * 100 : 0

  // Redirect if no session
  useEffect(() => {
    if (!session) navigate('/review')
  }, [session, navigate])

  // Spacebar flip
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.target?.toString().includes('Input')) {
        e.preventDefault()
        setFlipped((f) => !f)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!session || !card) return null

  const handleRate = (rating: 'easy' | 'hard' | 'again') => {
    rateCard(card.id, rating)
    if (current + 1 >= total) {
      navigate('/review/summary')
    } else {
      setDirection(1)
      setFlipped(false)
      setTimeout(() => nextCard(), 50)
    }
  }

  const barColor = CATEGORY_BAR[card.category] ?? '#818cf8'

  return (
    <Layout title="复习">
      {/* Progress topbar */}
      <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-surface-bg">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-text-primary">
            {current + 1} / {total}
          </span>
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
      <div className="flex flex-col items-center justify-between h-[calc(100vh-112px)] px-12 py-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={card.id}
            custom={direction}
            initial={{ x: direction * 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -direction * 60, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-[920px]"
          >
            {/* Flip card */}
            <div
              className="perspective cursor-pointer"
              onClick={() => setFlipped((f) => !f)}
            >
              <motion.div
                className="preserve-3d relative w-full"
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                style={{ minHeight: '340px' }}
              >
                {/* Front */}
                <div className="backface-hidden absolute inset-0 bg-surface-card border border-border rounded-xl p-7 flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <Badge category={card.category} size="md" />
                    <span className="text-xs text-text-dim">点击或按空格翻转</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <h2 className="text-3xl font-bold text-text-primary text-center">{card.content}</h2>
                  </div>
                  {card.example && (
                    <p className="text-sm text-text-dim italic text-center">"{card.example}"</p>
                  )}
                </div>

                {/* Back */}
                <div
                  className="backface-hidden absolute inset-0 bg-surface-card border rounded-xl p-7 flex flex-col gap-4 rotate-y-180"
                  style={{ borderColor: barColor + '40' }}
                >
                  <div className="flex items-center justify-between">
                    <Badge category={card.category} size="md" />
                    <span className="text-xs text-text-dim">已翻转</span>
                  </div>

                  {card.phonetic && (
                    <div className="flex items-center gap-2.5 bg-[#141420] border border-[#27272a] rounded-md px-3 py-2">
                      <Volume2 size={15} className="text-primary" />
                      <span className="text-sm text-[#a5b4fc]">{card.phonetic}</span>
                    </div>
                  )}

                  <div>
                    <div className="text-[11px] font-semibold text-text-dim mb-1">中文意思</div>
                    <p className="text-base text-text-primary">{card.translation}</p>
                  </div>

                  {card.synonyms && (
                    <>
                      <div className="h-px bg-border" />
                      <div>
                        <div className="text-xs font-semibold text-text-muted mb-2">🔄 同义短语</div>
                        <div className="flex flex-wrap gap-2">
                          {card.synonyms.map((syn) => (
                            <div key={syn} className="bg-[#1a1a28] border border-border rounded-md px-3 py-2 flex flex-col gap-1">
                              <span className="text-sm text-text-primary">{syn}</span>
                              <span className="flex items-center gap-1 text-[10px] text-primary">
                                <Plus size={9} />存入
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Rating buttons — only visible after flip */}
        <AnimatePresence>
          {flipped && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex items-center gap-4 mt-4"
            >
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => handleRate('again')}
                className="flex items-center gap-2 h-11 px-6 rounded-lg bg-[#450a0a] border border-[#7f1d1d] text-[#fb7185] text-sm font-medium hover:bg-[#7f1d1d] transition-colors"
              >
                <X size={15} />
                不会
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => handleRate('hard')}
                className="flex items-center gap-2 h-11 px-6 rounded-lg bg-[#2a1f0a] border border-[#92400e] text-[#fbbf24] text-sm font-medium hover:bg-[#78350f] transition-colors"
              >
                模糊
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => handleRate('easy')}
                className="flex items-center gap-2 h-11 px-6 rounded-lg bg-[#064e3b] border border-[#065f46] text-[#34d399] text-sm font-medium hover:bg-[#065f46] transition-colors"
              >
                <Check size={15} />
                掌握
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  )
}
