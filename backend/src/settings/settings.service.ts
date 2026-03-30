import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.appSettings.findMany()
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  }

  async patch(updates: Record<string, string>): Promise<Record<string, string>> {
    await this.prisma.$transaction(
      Object.entries(updates).map(([key, value]) =>
        this.prisma.appSettings.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        }),
      ),
    )
    return this.getAll()
  }
}
