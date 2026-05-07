import { useEffect, useCallback, useState } from 'react'
import { CirclePlay, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { StatCard } from '../components/ui/StatCard'
import { ActivityHeatmap } from '../components/ui/ActivityHeatmap'
import { MasteryRing } from '../components/ui/MasteryRing'
import { ExamCountdown } from '../components/ui/ExamCountdown'
import { DashboardInsight } from '../components/ui/DashboardInsight'
import { TodoList } from '../components/ui/TodoList'
import { Button } from '../components/ui/Button'
import { useAppStore } from '../store/useAppStore'

function getCSTDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { notes, openQuickNote, dashboardStats, dashboardStatsLoading, loadDashboardStats } = useAppStore()
  const [selectedTodoDate, setSelectedTodoDate] = useState(() => getCSTDateString())
  const [todayAllDone, setTodayAllDone] = useState(false)
  const [todayHasTodos, setTodayHasTodos] = useState(false)

  useEffect(() => {
    void loadDashboardStats()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleAllDone = useCallback((done: boolean) => {
    setTodayAllDone(done)
  }, [])

  const handleHasTodos = useCallback((has: boolean) => {
    setTodayHasTodos(has)
  }, [])

  const handleStartReview = () => navigate('/review')

  const dash = dashboardStats
  const loading = dashboardStatsLoading && !dash

  return (
    <Layout title="首页">
      <div className="p-8 flex flex-col gap-6">
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

        <DashboardInsight />

        <div className="grid grid-cols-4 gap-4">
          <StatCard
            value={loading ? '—' : (dash?.createdToday ?? '—')}
            label="今日新增"
            accentColor="#818cf8"
            tooltip="今日新加入的笔记数"
          />
          <StatCard
            value={loading ? '—' : (dash?.mastered ?? '—')}
            label="已掌握"
            accentColor="#34d399"
            tooltip="复习评分连续 3 次 Easy 后升为已掌握"
          />
          <StatCard
            value={loading ? '—' : (dash?.streak ?? '—')}
            label="连续学习天数"
            accentColor="#fbbf24"
            tooltip="连续每日有复习记录的天数（当日尚未复习则从昨天起算）"
          />
          <StatCard
            value={loading ? '—' : (dash?.total ?? '—')}
            label="总笔记"
            accentColor="#fb7185"
            tooltip="知识库中全部笔记总数"
          />
        </div>

        <div className="grid grid-cols-[1fr_260px] gap-5 items-start">
          <div className="flex flex-col gap-5">
            <div className="bg-surface-card border border-border rounded-xl p-5 min-w-0">
              <ActivityHeatmap
                todayAllDone={todayAllDone}
                todayHasTodos={todayHasTodos}
                selectedDate={selectedTodoDate}
                onDateSelect={setSelectedTodoDate}
              />
            </div>
            <div className="bg-surface-card border border-border rounded-xl p-5">
              <TodoList
                onAllDone={handleAllDone}
                onHasTodos={handleHasTodos}
                selectedDate={selectedTodoDate}
                onSelectedDateChange={setSelectedTodoDate}
              />
            </div>
          </div>
          <div className="flex flex-col gap-5 min-w-0">
            <div className="bg-surface-card border border-border rounded-xl p-5">
              <MasteryRing notes={notes} />
            </div>
            <div className="bg-surface-card border border-border rounded-xl p-5">
              <ExamCountdown />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
