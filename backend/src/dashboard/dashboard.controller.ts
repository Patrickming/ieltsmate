import { Controller, Get, Query } from '@nestjs/common'
import { DashboardService } from './dashboard.service'

@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard/stats')
  stats() {
    return this.dashboardService.getStats()
  }

  @Get('activity')
  activity(@Query('start') start: string, @Query('end') end: string) {
    return this.dashboardService.getActivity(start, end)
  }
}
