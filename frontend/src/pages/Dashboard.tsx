import { useState, useEffect, useCallback } from 'react'
import { CirclePlay, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { StatCard } from '../components/ui/StatCard'
import { ActivityHeatmap } from '../components/ui/ActivityHeatmap'
import { MasteryRing } from '../components/ui/MasteryRing'
import { TodoList } from '../components/ui/TodoList'
import { Button } from '../components/ui/Button'
import { LoadingState } from '../components/ui/LoadingState'
import { useAppStore } from '../store/useAppStore'
import { mockStats } from '../data/mockData'

export default function Dashboard() {
  const navigate = useNavigate()
  const { notes, openQuickNote } = useAppStore()
  const [pageLoading] = useState(false)
  const [todayAllDone, setTodayAllDone] = useState(false)
  const handleAllDone = useCallback((done: boolean) => setTodayAllDone(done), [])

  useEffect(() => {
    const main = document.querySelector('main')
    const savedScroll = sessionStorage.getItem('scroll-y:/')
    if (savedScroll && main) {
      requestAnimationFrame(() => {
        main.scrollTop = parseInt(savedScroll)
        sessionStorage.removeItem('scroll-y:/')
      })
    }
  }, [])

  const handleStartReview = () => {
    navigate('/review')
  }

  if (pageLoading) {
    return (
      <Layout title="首页">
        <LoadingState />
      </Layout>
    )
  }

  return (
    <Layout title="首页">
      <div className="p-8 flex flex-col gap-6">
        {/* Section header */}
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-text-primary">仪表盘</h1>
            <p className="text-sm text-text-dim mt-1">今日学习与知识库概览</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="lg"
              icon={<CirclePlay size={14} />}
              className="h-9 min-h-9 rounded-sm text-[13px] px-4"
              onClick={handleStartReview}
            >
              开始今日复习
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              icon={<Plus size={14} />}
              className="h-9 min-h-9 rounded-sm text-[13px] px-4"
              onClick={openQuickNote}
            >
              添加新笔记
            </Button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard value={mockStats.dueToday} label="今日待复习" sublabel="含到期+新卡" accentColor="#818cf8" />
          <StatCard value={mockStats.mastered} label="已掌握" sublabel="占全部 65%" accentColor="#34d399" />
          <StatCard value={mockStats.streak} label="连续学习天数" sublabel="按自然日累计" accentColor="#fbbf24" />
          <StatCard value={mockStats.total} label="总笔记" sublabel="知识库条数" accentColor="#fb7185" />
        </div>

        {/* 学习概览 */}
        <div className="grid grid-cols-[1fr_260px] gap-5 items-start">
          {/* 左列：热图 + 今日任务 */}
          <div className="flex flex-col gap-5">
            <div className="bg-surface-card border border-border rounded-xl p-5 overflow-x-auto">
              <ActivityHeatmap todayAllDone={todayAllDone} />
            </div>
            <div className="bg-surface-card border border-border rounded-xl p-5">
              <TodoList onAllDone={handleAllDone} />
            </div>
          </div>

          {/* 右列：掌握进度 */}
          <div className="bg-surface-card border border-border rounded-xl p-5">
            <MasteryRing notes={notes} />
          </div>
        </div>
      </div>
    </Layout>
  )
}
