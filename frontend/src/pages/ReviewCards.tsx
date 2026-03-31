import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Volume2, Plus, Check, Sparkles, HelpCircle, LogOut, BookOpen, Keyboard } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layout } from '../components/layout/Layout'
import { Badge } from '../components/ui/Badge'
import { StrokeButton } from '../components/ui/StrokeButton'
import { useAppStore } from '../store/useAppStore'
import { CATEGORY_BAR, type Category } from '../data/mockData'
import type { Note } from '../data/mockData'
import { apiUrl } from '../lib/apiBase'

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
  const inputRef = useRef<HTMLInputElement>(null)
  const barColor = CATEGORY_BAR[note.category] ?? '#818cf8'

  const translationLines = note.translation
    ? note.translation.split(/[；;]/).map(s => s.trim()).filter(Boolean)
    : []

  const wordLen = note.content.length
  const firstLetter = note.content[0] ?? ''

  // Auto-focus input when spelling card mounts
  useEffect(() => {
    if (cardType === 'spelling') {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [cardType, note.id])

  if (cardType === 'spelling') {
    return (
      <div className="flex flex-col h-full" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
          <Badge category={note.category} size="md" />
          <div className="flex items-center gap-1.5" style={{ color: barColor + 'aa' }}>
            <Keyboard size={12} />
            <span className="text-[11px] font-medium tracking-wide">拼写挑战</span>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 flex flex-col justify-center items-center gap-5 px-8 pb-5 min-h-0">

          {/* Definition card */}
          <div className="w-full max-w-[560px] rounded-2xl overflow-hidden border"
            style={{ background: '#0d0d12', borderColor: '#1f1f2e' }}>
            <div className="flex items-center gap-2 px-4 py-2.5 border-b"
              style={{ borderColor: '#1a1a26', background: '#111118' }}>
              <BookOpen size={12} style={{ color: barColor }} />
              <span className="text-[10px] font-bold uppercase tracking-[1.5px]" style={{ color: barColor }}>
                词义参考
              </span>
              {note.phonetic && (
                <>
                  <div className="w-px h-3 bg-[#27272a] mx-1" />
                  <Volume2 size={11} className="text-text-subtle" />
                  <span className="text-[12px] font-mono" style={{ color: barColor + '99' }}>
                    {note.phonetic}
                  </span>
                </>
              )}
            </div>
            <div className="px-5 py-4 flex flex-col gap-2">
              {translationLines.map((line, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-[11px] font-bold shrink-0 mt-1 tabular-nums"
                    style={{ color: barColor + 'bb' }}>
                    {String(i + 1).padStart(2, '0')}.
                  </span>
                  <p className="text-[16px] text-text-secondary leading-relaxed">{line}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Letter count row */}
          <div className="flex flex-col items-center gap-2 w-full max-w-[560px]">
            <div className="flex items-center gap-1.5">
              {/* First letter box (revealed) */}
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center text-[15px] font-bold font-mono"
                style={{ background: barColor + '22', border: `1px solid ${barColor}66`, color: barColor }}
              >
                {firstLetter.toUpperCase()}
              </div>
              {/* Remaining letters as dashes */}
              {Array.from({ length: Math.max(0, wordLen - 1) }).map((_, i) => (
                <div
                  key={i}
                  className="w-5 h-7 flex items-end justify-center pb-1"
                >
                  <div className="w-4 h-px rounded-full" style={{ background: '#3f3f46' }} />
                </div>
              ))}
              <span className="ml-2 text-[11px] text-text-subtle tabular-nums">
                {wordLen} 个字母
              </span>
            </div>

            {/* Input field */}
            <input
              ref={inputRef}
              value={answer ?? ''}
              onChange={e => onAnswerChange?.(e.target.value)}
              placeholder={`${firstLetter.toLowerCase()}${'·'.repeat(Math.max(0, wordLen - 1))}`}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                e.stopPropagation()
                // allow Space in input without flipping card
              }}
              className="w-full h-14 rounded-2xl px-5 text-[20px] text-center font-mono outline-none transition-all duration-200 tracking-[6px]"
              style={{
                background: '#0d0d12',
                border: `2px solid ${answer ? barColor + '66' : '#27272a'}`,
                color: '#fafafa',
                boxShadow: answer ? `0 0 16px ${barColor}22` : 'none',
                caretColor: barColor,
              }}
              autoComplete="off"
              spellCheck={false}
            />

            <p className="text-[11px] text-text-subtle">
              输入后按 <kbd className="px-1.5 py-0.5 rounded bg-[#27272a] border border-[#3f3f46] text-[10px] text-text-dim font-mono">Space</kbd> 或点击卡片翻转查看
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-8">
      <Badge category={note.category} size="md" />
      <h2 className="text-[2.8rem] font-bold text-text-primary text-center leading-tight">
        {note.content}
      </h2>
      <p className="text-base text-text-dim">点击卡片或按空格键翻转</p>
    </div>
  )
}

// ── AI types (mirroring backend) ────────────────────────────────────────────
interface AIContentBase { fallback: boolean }
interface WordSpeechAI extends AIContentBase { fallback: false; phonetic: string; synonyms: string[]; antonyms: string[]; example: string; exampleTranslation?: string; memoryTip: string }
interface PhraseAI extends AIContentBase { fallback: false; phonetic: string; synonyms: string[]; antonyms: string[]; example: string; exampleTranslation?: string; memoryTip: string }
interface SynonymAI extends AIContentBase { fallback: false; wordMeanings: Array<{ word: string; phonetic: string; meaning: string }>; antonymGroup: string[]; moreSynonyms: string[] }
interface SentenceAI extends AIContentBase { fallback: false; analysis: string; paraphrases: Array<{ sentence: string; dimension: string }> }
interface SpellingAI extends AIContentBase { fallback: false; phonetic: string; synonyms: string[]; antonyms: string[]; memoryTip: string; contextExample: { sentence: string; translation?: string; analysis: string } }
interface FallbackAI extends AIContentBase { fallback: true; phonetic: string | null; translation: string; synonyms: string[]; antonyms: string[]; example: string | null; memoryTip: string | null }
type CardAIContent = WordSpeechAI | PhraseAI | SynonymAI | SentenceAI | SpellingAI | FallbackAI

// ── AI loading animation ──────────────────────────────────────────────────────
function AILoadingAnimation() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent"
      />
      <div className="flex items-center gap-1.5">
        <Sparkles size={14} className="text-primary" />
        <span className="text-sm text-text-dim">AI 正在生成内容...</span>
      </div>
    </div>
  )
}

// ── Synonym/Antonym save chip ──────────────────────────────────────────────────
function SaveChip({ word, saved, onSave }: { word: string; saved: boolean; onSave: (w: string) => void }) {
  return (
    <div
      className="flex flex-col gap-1.5 px-3 py-2.5 rounded-md border"
      style={saved ? { background: '#1a2e22', borderColor: '#34d399' } : { background: '#1a1a28', borderColor: '#27272a' }}
    >
      <span className="text-[15px] text-text-primary">{word}</span>
      <button onClick={() => onSave(word)} className="flex items-center gap-1" style={{ color: saved ? '#34d399' : '#818cf8' }}>
        {saved ? <Check size={10} /> : <Plus size={10} />}
        <span className="text-[11px]">{saved ? '✓ 已存入' : '存入'}</span>
      </button>
    </div>
  )
}

// ── CardBack sub-components ───────────────────────────────────────────────────
function CardBackWordPhrase({ note, ai, savedSyn, savedAnt, onSaveSyn, onSaveAnt }: {
  note: Note; ai: WordSpeechAI | PhraseAI
  savedSyn: string[]; savedAnt: string[]; onSaveSyn: (s: string) => void; onSaveAnt: (s: string) => void
}) {
  const barColor = CATEGORY_BAR[note.category] ?? '#818cf8'
  return (
    <div className="flex flex-col gap-5 p-7 overflow-y-auto h-full" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <Badge category={note.category} size="md" />
        <span className="text-sm text-text-dim">已翻转</span>
      </div>
      {ai.phonetic && (
        <div className="flex items-center gap-2.5 bg-[#141420] border border-[#27272a] rounded-md px-3.5 py-3 w-fit">
          <Volume2 size={16} className="text-primary" />
          <span className="text-[16px] text-[#a5b4fc]">{ai.phonetic}</span>
        </div>
      )}
      <div>
        <div className="text-sm font-semibold text-text-dim mb-1.5">中文意思</div>
        <p className="text-[17px] text-text-primary leading-snug">{note.translation}</p>
      </div>
      <div className="h-px bg-border" />
      {ai.synonyms.length > 0 && (
        <div>
          <AITip label="🔄 同义词/短语" tip="AI 实时生成，点击「存入」可保存到知识库" />
          <div className="flex flex-wrap gap-2 mt-2.5">
            {ai.synonyms.map(s => <SaveChip key={s} word={s} saved={savedSyn.includes(s)} onSave={onSaveSyn} />)}
          </div>
        </div>
      )}
      {ai.antonyms.length > 0 && (
        <div>
          <AITip label="🔀 反义词/短语" tip="AI 生成的语义对立词，点击「存入」可关联到知识库" />
          <div className="flex flex-wrap gap-2 mt-2.5">
            {ai.antonyms.map(s => <SaveChip key={s} word={s} saved={savedAnt.includes(s)} onSave={onSaveAnt} />)}
          </div>
        </div>
      )}
      {ai.memoryTip && (
        <div className="rounded-lg border px-4 py-3.5" style={{ background: '#1e1a2e', borderColor: barColor + '40' }}>
          <AITip label="✨ 记忆技巧" tip="AI 基于词源/联想生成，帮助加深印象" />
          <p className="text-[13px] text-[#c4b5fd] leading-relaxed mt-2">{ai.memoryTip}</p>
        </div>
      )}
      {ai.example && (
        <div>
          <div className="h-px bg-border mb-4" />
          <div className="text-sm font-semibold text-text-muted mb-2">💬 例句</div>
          <div className="bg-[#141420] border border-[#27272a] rounded-md px-4 py-3.5 flex flex-col gap-2">
            <p className="text-[14px] text-text-secondary italic leading-relaxed">"{ai.example}"</p>
            {ai.exampleTranslation && (
              <p className="text-[13px] text-text-dim leading-relaxed">{ai.exampleTranslation}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CardBackSynonym({ note, ai, savedSyn, savedAnt, onSaveSyn, onSaveAnt }: {
  note: Note; ai: SynonymAI
  savedSyn: string[]; savedAnt: string[]; onSaveSyn: (s: string) => void; onSaveAnt: (s: string) => void
}) {
  // Format a word-meaning pair for saving: "word (briefMeaning)"
  const formatWmKey = (wm: { word: string; meaning: string }) => {
    const brief = wm.meaning.split(/[。，]/)[0].trim().slice(0, 20)
    return brief ? `${wm.word} (${brief})` : wm.word
  }

  return (
    <div className="flex flex-col gap-5 p-7 overflow-y-auto h-full" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <Badge category={note.category} size="md" />
        <span className="text-sm text-text-dim">已翻转</span>
      </div>
      <div>
        <AITip label="各词细微差别" tip="点击「存入」可将该词（含中文释义）保存到知识库同义词" />
        <div className="flex flex-col gap-3 mt-2.5">
          {ai.wordMeanings.map(wm => {
            const saveKey = formatWmKey(wm)
            const isSaved = savedSyn.includes(saveKey)
            return (
              <div key={wm.word} className="bg-[#141420] border border-[#27272a] rounded-xl px-4 py-3.5">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[17px] font-bold text-text-primary">{wm.word}</span>
                    {wm.phonetic && <span className="text-[13px] text-[#a5b4fc]">{wm.phonetic}</span>}
                  </div>
                  <button
                    onClick={() => onSaveSyn(saveKey)}
                    className="flex items-center gap-1 shrink-0 mt-0.5"
                    style={{ color: isSaved ? '#34d399' : '#818cf8' }}
                  >
                    {isSaved ? <Check size={10} /> : <Plus size={10} />}
                    <span className="text-[11px]">{isSaved ? '✓ 已存入' : '存入'}</span>
                  </button>
                </div>
                <p className="text-[14px] text-text-secondary leading-relaxed">{wm.meaning}</p>
              </div>
            )
          })}
        </div>
      </div>
      <div className="h-px bg-border" />
      {ai.antonymGroup.length > 0 && (
        <div>
          <AITip label="🔀 反义同义替换" tip="AI 生成的语义对立替换词组，点击「存入」可保存到知识库反义词" />
          <div className="flex flex-wrap gap-2 mt-2.5">
            {ai.antonymGroup.map(w => <SaveChip key={w} word={w} saved={savedAnt.includes(w)} onSave={onSaveAnt} />)}
          </div>
        </div>
      )}
      {ai.moreSynonyms.length > 0 && (
        <div>
          <AITip label="➕ 更多同义替换" tip="AI 扩展生成的近义词组，点击「存入」可保存到知识库同义词" />
          <div className="flex flex-wrap gap-2 mt-2.5">
            {ai.moreSynonyms.map(w => <SaveChip key={w} word={w} saved={savedSyn.includes(w)} onSave={onSaveSyn} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function CardBackSentence({ note, ai }: { note: Note; ai: SentenceAI }) {
  return (
    <div className="flex flex-col gap-5 p-7 overflow-y-auto h-full" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <Badge category={note.category} size="md" />
        <span className="text-sm text-text-dim">已翻转</span>
      </div>
      <div>
        <div className="text-sm font-semibold text-text-dim mb-1.5">中文意思</div>
        <p className="text-[17px] text-text-primary leading-snug">{note.translation}</p>
      </div>
      <div className="h-px bg-border" />
      <div>
        <AITip label="📖 句意解析" tip="AI 用自然语言帮助你读懂这句话的逻辑结构" />
        <div className="bg-[#141420] border border-[#27272a] rounded-xl px-4 py-4 mt-2.5">
          <p className="text-[14px] text-text-secondary leading-relaxed">{ai.analysis}</p>
        </div>
      </div>
      {ai.paraphrases.length > 0 && (
        <div>
          <AITip label="🔄 同义改写" tip="AI 生成不同维度的同义替换句" />
          <div className="flex flex-col gap-3 mt-2.5">
            {ai.paraphrases.map((p, i) => (
              <div key={i} className="bg-[#141420] border border-[#27272a] rounded-xl px-4 py-3.5">
                <span className="text-[10px] font-bold text-text-subtle uppercase tracking-wider">{p.dimension}</span>
                <p className="text-[14px] text-text-secondary leading-relaxed mt-1.5 italic">"{p.sentence}"</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CardBackSpelling({ note, ai, savedSyn, savedAnt, onSaveSyn, onSaveAnt, spellingAnswer }: {
  note: Note; ai: SpellingAI
  savedSyn: string[]; savedAnt: string[]; onSaveSyn: (s: string) => void; onSaveAnt: (s: string) => void
  spellingAnswer?: string
}) {
  const barColor = CATEGORY_BAR[note.category] ?? '#818cf8'
  const spellingCorrect = spellingAnswer
    ? spellingAnswer.trim().toLowerCase() === note.content.trim().toLowerCase()
    : null

  return (
    <div className="flex flex-col gap-5 p-7 overflow-y-auto h-full" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <Badge category={note.category} size="md" />
        <span className="text-sm text-text-dim">已翻转</span>
      </div>
      {spellingAnswer && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{ background: spellingCorrect ? '#0d2b1f' : '#2e0f0f', borderColor: spellingCorrect ? '#34d399' : '#fb7185' }}>
          <span className="text-2xl">{spellingCorrect ? '✓' : '✗'}</span>
          <div>
            <p className="text-sm text-text-dim mb-0.5">你的答案</p>
            <p className="text-[17px] font-mono font-semibold" style={{ color: spellingCorrect ? '#34d399' : '#fb7185' }}>{spellingAnswer}</p>
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
      {ai.phonetic && (
        <div className="flex items-center gap-2.5 bg-[#141420] border border-[#27272a] rounded-md px-3.5 py-3 w-fit">
          <Volume2 size={16} className="text-primary" />
          <span className="text-[16px] text-[#a5b4fc]">{ai.phonetic}</span>
        </div>
      )}
      <div>
        <div className="text-sm font-semibold text-text-dim mb-1.5">中文意思</div>
        <p className="text-[17px] text-text-primary leading-snug">{note.translation}</p>
      </div>
      <div className="h-px bg-border" />
      {ai.synonyms.length > 0 && (
        <div>
          <AITip label="🔄 同义词" tip="点击「存入」可保存到知识库" />
          <div className="flex flex-wrap gap-2 mt-2.5">
            {ai.synonyms.map(s => <SaveChip key={s} word={s} saved={savedSyn.includes(s)} onSave={onSaveSyn} />)}
          </div>
        </div>
      )}
      {ai.antonyms.length > 0 && (
        <div>
          <AITip label="🔀 反义词" tip="点击「存入」可关联到知识库" />
          <div className="flex flex-wrap gap-2 mt-2.5">
            {ai.antonyms.map(s => <SaveChip key={s} word={s} saved={savedAnt.includes(s)} onSave={onSaveAnt} />)}
          </div>
        </div>
      )}
      {ai.memoryTip && (
        <div className="rounded-lg border px-4 py-3.5" style={{ background: '#1e1a2e', borderColor: barColor + '40' }}>
          <AITip label="✨ 拼写记忆技巧" tip="词根词缀拆解，帮助记忆拼写" />
          <p className="text-[13px] text-[#c4b5fd] leading-relaxed mt-2">{ai.memoryTip}</p>
        </div>
      )}
      <div>
        <div className="h-px bg-border mb-4" />
        <AITip label="💬 例句与分析" tip="AI 生成的语境例句及用法解析" />
        <div className="bg-[#141420] border border-[#27272a] rounded-xl px-4 py-3.5 mt-2.5 flex flex-col gap-2">
          <p className="text-[14px] text-text-secondary italic leading-relaxed">"{ai.contextExample.sentence}"</p>
          {ai.contextExample.translation && (
            <p className="text-[13px] text-text-dim leading-relaxed">{ai.contextExample.translation}</p>
          )}
          <p className="text-[12px] text-text-subtle leading-relaxed border-t border-[#27272a] pt-2 mt-1">{ai.contextExample.analysis}</p>
        </div>
      </div>
    </div>
  )
}

function CardBackFallback({ note, cardType, spellingAnswer }: {
  note: Note
  cardType: ReturnType<typeof getCardType>
  spellingAnswer?: string
}) {
  const barColor = CATEGORY_BAR[note.category] ?? '#818cf8'
  const spellingCorrect = cardType === 'spelling' && spellingAnswer
    ? spellingAnswer.trim().toLowerCase() === note.content.trim().toLowerCase()
    : null

  return (
    <div className="flex flex-col gap-5 p-7 overflow-y-auto h-full" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <Badge category={note.category} size="md" />
        <span className="text-sm text-text-dim">已翻转</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-yellow-400 bg-yellow-950/30 border border-yellow-800/40">
        <span>⚠</span>
        <span>AI 内容生成失败，显示基础内容</span>
      </div>
      {spellingAnswer && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{ background: spellingCorrect ? '#0d2b1f' : '#2e0f0f', borderColor: spellingCorrect ? '#34d399' : '#fb7185' }}>
          <span className="text-2xl">{spellingCorrect ? '✓' : '✗'}</span>
          <div>
            <p className="text-sm text-text-dim mb-0.5">你的答案</p>
            <p className="text-[17px] font-mono font-semibold" style={{ color: spellingCorrect ? '#34d399' : '#fb7185' }}>{spellingAnswer}</p>
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
      {note.phonetic && (
        <div className="flex items-center gap-2.5 bg-[#141420] border border-[#27272a] rounded-md px-3.5 py-3 w-fit">
          <Volume2 size={16} className="text-primary" />
          <span className="text-[16px] text-[#a5b4fc]">{note.phonetic}</span>
        </div>
      )}
      <div>
        <div className="text-sm font-semibold text-text-dim mb-1.5">中文意思</div>
        <p className="text-[17px] text-text-primary leading-snug">{note.translation}</p>
      </div>
      {(note.synonyms?.length > 0 || note.antonyms?.length > 0) && <div className="h-px bg-border" />}
      {note.synonyms && note.synonyms.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-text-dim mb-2">🔄 同义词/短语</div>
          <div className="flex flex-wrap gap-2">{note.synonyms.map(s => (
            <span key={s} className="px-3 py-1.5 rounded-full text-[13px] border" style={{ background: '#1a1a28', borderColor: '#27272a', color: '#a5b4fc' }}>{s}</span>
          ))}</div>
        </div>
      )}
      {note.antonyms && note.antonyms.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-text-dim mb-2">🔀 反义词/短语</div>
          <div className="flex flex-wrap gap-2">{note.antonyms.map(s => (
            <span key={s} className="px-3 py-1.5 rounded-full text-[13px] border" style={{ background: '#1a1a28', borderColor: '#27272a', color: '#fca5a5' }}>{s}</span>
          ))}</div>
        </div>
      )}
      {note.memoryTip && (
        <div className="rounded-lg border px-4 py-3.5" style={{ background: '#1e1a2e', borderColor: barColor + '40' }}>
          <div className="text-sm font-semibold text-text-dim mb-1">✨ 记忆技巧</div>
          <p className="text-[13px] text-[#c4b5fd] leading-relaxed">{note.memoryTip}</p>
        </div>
      )}
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

// ── Main CardBack dispatcher ──────────────────────────────────────────────────
function CardBack({ note, cardType, aiContent, savedSyn, savedAnt, onSaveSyn, onSaveAnt, spellingAnswer }: {
  note: Note
  cardType: ReturnType<typeof getCardType>
  aiContent: CardAIContent | null | undefined
  savedSyn: string[]
  savedAnt: string[]
  onSaveSyn: (s: string) => void
  onSaveAnt: (s: string) => void
  spellingAnswer?: string
}) {
  if (aiContent === undefined || aiContent === null) {
    return <AILoadingAnimation />
  }

  if (aiContent.fallback) {
    return <CardBackFallback note={note} cardType={cardType} spellingAnswer={spellingAnswer} />
  }

  switch (cardType) {
    case 'word-speech':
    case 'phrase':
      return <CardBackWordPhrase note={note} ai={aiContent as WordSpeechAI} savedSyn={savedSyn} savedAnt={savedAnt} onSaveSyn={onSaveSyn} onSaveAnt={onSaveAnt} />
    case 'synonym':
      return <CardBackSynonym note={note} ai={aiContent as SynonymAI} savedSyn={savedSyn} savedAnt={savedAnt} onSaveSyn={onSaveSyn} onSaveAnt={onSaveAnt} />
    case 'sentence':
      return <CardBackSentence note={note} ai={aiContent as SentenceAI} />
    case 'spelling':
      return <CardBackSpelling note={note} ai={aiContent as SpellingAI} savedSyn={savedSyn} savedAnt={savedAnt} onSaveSyn={onSaveSyn} onSaveAnt={onSaveAnt} spellingAnswer={spellingAnswer} />
    default:
      return <CardBackWordPhrase note={note} ai={aiContent as WordSpeechAI} savedSyn={savedSyn} savedAnt={savedAnt} onSaveSyn={onSaveSyn} onSaveAnt={onSaveAnt} />
  }
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
  const { reviewSession, nextCard, rateCard, abortReviewSession, incrementSavedExtensions } = useAppStore()
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [savedSyn, setSavedSyn] = useState<string[]>([])
  const [savedAnt, setSavedAnt] = useState<string[]>([])
  const [spellingAnswer, setSpellingAnswer] = useState('')

  const session = reviewSession
  const card = session?.cards[session.current]
  const remaining = session?.cards.length ?? 0
  const current = session?.current ?? 0
  const completedOffset = session?.completedOffset ?? 0
  // Total includes already-completed cards from a previous continue session
  const total = remaining + completedOffset
  // Display position accounts for the offset so progress bar starts from the middle in continue mode
  const displayCurrent = current + completedOffset
  const progress = total > 0 ? ((displayCurrent + 1) / total) * 100 : 0

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
  const aiContent = session.aiContent[card.id] as CardAIContent | null | undefined

  const handleRate = (rating: 'easy' | 'again') => {
    rateCard(card.id, rating, cardType === 'spelling' ? spellingAnswer : undefined)
    setFlipped(false)
    setSavedSyn([])
    setSavedAnt([])
    setSpellingAnswer('')
    setTimeout(() => {
      if (current + 1 >= remaining) {
        navigate('/review/summary')
      } else {
        nextCard()
      }
    }, 300)
  }

  const handleSaveSyn = async (syn: string) => {
    if (savedSyn.includes(syn)) return
    setSavedSyn(p => [...p, syn])
    // Include all previously saved synonyms + the new one to avoid overwriting
    const newSynonyms = [...(card.synonyms ?? []), ...savedSyn, syn]
    try {
      const res = await fetch(apiUrl(`/notes/${card.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ synonyms: newSynonyms }),
      })
      if (res.ok) {
        incrementSavedExtensions()
      } else {
        setSavedSyn(p => p.filter(s => s !== syn))
      }
    } catch {
      setSavedSyn(p => p.filter(s => s !== syn))
    }
  }

  const handleSaveAnt = async (ant: string) => {
    if (savedAnt.includes(ant)) return
    setSavedAnt(p => [...p, ant])
    // Include all previously saved antonyms + the new one to avoid overwriting
    const newAntonyms = [...(card.antonyms ?? []), ...savedAnt, ant]
    try {
      const res = await fetch(apiUrl(`/notes/${card.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ antonyms: newAntonyms }),
      })
      if (res.ok) {
        incrementSavedExtensions()
      } else {
        setSavedAnt(p => p.filter(s => s !== ant))
      }
    } catch {
      setSavedAnt(p => p.filter(s => s !== ant))
    }
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
            <span className="text-sm font-semibold text-text-primary tabular-nums">{displayCurrent + 1} / {total}</span>
            <div className="w-40 h-1.5 bg-[#27272a] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: `${total > 0 ? (completedOffset / total) * 100 : 0}%` }}
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
                  onClick={() => { void abortReviewSession(); navigate('/review') }}
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
                      cardType={cardType}
                      aiContent={aiContent}
                      savedSyn={savedSyn}
                      savedAnt={savedAnt}
                      onSaveSyn={(s) => { void handleSaveSyn(s) }}
                      onSaveAnt={(s) => { void handleSaveAnt(s) }}
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
