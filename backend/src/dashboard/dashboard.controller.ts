import { Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common'
import { DashboardService } from './dashboard.service'

@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard/stats')
  stats() {
    return this.dashboardService.getStats()
  }

  /**
   * 默认：按冷却返回缓存或自动生成。
   * `?refresh=1` / `?refresh=true`：手动重新生成并重置 15 分钟冷却（与 POST /dashboard/insight/refresh 等价，便于仅放行 GET 的代理）。
   */
  @Get('dashboard/insight')
  insight(@Query('refresh') refresh?: string) {
    const force = refresh === '1' || refresh === 'true'
    if (force) return this.dashboardService.forceRegenerateInsight()
    return this.dashboardService.getOrRefreshInsight()
  }

  /** 手动重新生成（与 GET ?refresh=1 二选一） */
  @Post('dashboard/insight/refresh')
  @HttpCode(HttpStatus.OK)
  refreshInsight() {
    return this.dashboardService.forceRegenerateInsight()
  }

  @Get('activity')
  activity(@Query('start') start: string, @Query('end') end: string) {
    return this.dashboardService.getActivity(start, end)
  }
}
