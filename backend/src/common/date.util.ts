import { BadRequestException } from '@nestjs/common'

const CST_TIMEZONE = 'Asia/Shanghai'

function getCSTDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** 返回上海当日 00:00 对应的 UTC Date（等价于 `YYYY-MM-DDT00:00:00+08:00`）*/
export function todayCSTMidnight(): Date {
  const dateStr = getCSTDateString(new Date())
  return new Date(`${dateStr}T00:00:00+08:00`)
}

/**
 * 将 "YYYY-MM-DD" 解析为上海当日 00:00 的 UTC Date。
 * 格式非法或日期无效时抛 BadRequestException（400）。
 */
export function parseCSTDate(dateStr: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new BadRequestException(`日期格式非法，需为 YYYY-MM-DD: ${dateStr}`)
  }
  const d = new Date(`${dateStr}T00:00:00+08:00`)
  if (isNaN(d.getTime())) {
    throw new BadRequestException(`无效日期: ${dateStr}`)
  }
  return d
}

/** 将 UTC Date 格式化为上海日历日字符串 "YYYY-MM-DD"*/
export function formatCSTDate(d: Date): string {
  return getCSTDateString(d)
}
