import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

interface StatCardProps {
  value: number
  label: string
  sublabel: string
  accentColor: string
}

function AnimatedNumber({ target }: { target: number }) {
  const [display, setDisplay] = useState(0)
  const raw = useMotionValue(0)
  const spring = useSpring(raw, { stiffness: 80, damping: 18 })
  const started = useRef(false)

  useEffect(() => {
    if (!started.current) {
      started.current = true
      raw.set(target)
    }
  }, [raw, target])

  useEffect(() => {
    const unsub = spring.on('change', (v) => setDisplay(Math.round(v)))
    return unsub
  }, [spring])

  return <span>{display}</span>
}

export function StatCard({ value, label, sublabel, accentColor }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      whileHover={{ y: -3, boxShadow: `0 8px 32px ${accentColor}22` }}
      className="flex-1 bg-surface-card border border-border rounded-lg overflow-hidden cursor-default transition-shadow"
    >
      <div className="h-[3px] w-full" style={{ background: accentColor }} />
      <div className="p-5 flex flex-col gap-2">
        <div className="text-4xl font-bold" style={{ color: accentColor }}>
          <AnimatedNumber target={value} />
        </div>
        <div className="text-sm font-semibold text-text-secondary">{label}</div>
        <div className="text-xs text-text-dim">{sublabel}</div>
      </div>
    </motion.div>
  )
}
