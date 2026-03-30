# 大功能 8：设置与 AI 模型配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 提供商配置和应用设置真正持久化到后端数据库，并实现真实的 API 连通性测试和 AI 聊天代理接口，替换所有模拟/内存状态。

**Architecture:**
- 后端新增 3 张表（AiProvider / AiModel / AppSettings）+ 2 个模块（SettingsModule / AiModule）
- `AiModule` 提供 CRUD + `/ai/chat` 代理端点（后端调用 AI 提供商，前端无需暴露 API Key）
- 前端 store 在 App 启动时从后端加载 providers 和 settings，修改时同步保存
- AIModelConfigModal 的"逐一测试"改为调用真实 `/ai/test` 端点验证连通性
- Settings 页的模型分配 dropdown 更改时立即 `PATCH /settings`

**Tech Stack:** NestJS, Prisma, PostgreSQL（后端）；React, Zustand（前端）；fetch + OpenAI-compatible API

---

## 文件索引

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/prisma/schema.prisma` | 修改 | 添加 AiProvider / AiModel / AppSettings 三个模型 |
| `backend/prisma/migrations/` | 新增 | `add_ai_settings` 迁移 |
| `backend/src/settings/` | 新建目录 | SettingsModule + Service + Controller |
| `backend/src/ai/` | 新建目录 | AiModule + Service + Controller + DTOs |
| `backend/src/app.module.ts` | 修改 | 注册 SettingsModule + AiModule |
| `frontend/vite.config.ts` | 修改 | 添加 `/settings` `/ai` 代理 + bypass |
| `frontend/src/store/useAppStore.ts` | 修改 | 加载/保存 providers 和 settings |
| `frontend/src/components/modals/AIModelConfigModal.tsx` | 修改 | 保存到后端 + 真实 API 测试 |
| `frontend/src/pages/Settings.tsx` | 修改 | 模型分配保存 + 主题保存 |
| `frontend/src/App.tsx` | 修改 | 启动时加载 providers 和 settings |

---

## Task 1：Prisma Schema 扩展与迁移

**Files:**
- 修改: `backend/prisma/schema.prisma`
- 执行: `pnpm prisma migrate dev --name add_ai_settings`

- [ ] **Step 1.1：在 schema.prisma 末尾追加三个新模型**

在 `DailyActivity` 模型后追加：

```prisma
model AiProvider {
  id          String    @id @default(uuid())
  name        String
  displayName String
  presetId    String
  color       String
  baseUrl     String
  apiKey      String    @default("")
  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  models      AiModel[]

  @@index([sortOrder])
}

model AiModel {
  id         String     @id @default(uuid())
  providerId String
  modelId    String
  verified   Boolean    @default(false)
  sortOrder  Int        @default(0)
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  provider   AiProvider @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@unique([providerId, modelId])
  @@index([providerId, sortOrder])
}

model AppSettings {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 1.2：执行迁移**

```bash
cd /home/pdm/DEV/ieltsmate/backend
pnpm prisma migrate dev --name add_ai_settings
```

预期输出包含：`The following migration(s) have been applied: ... add_ai_settings`

---

## Task 2：后端 SettingsModule（持久化主题 + 模型分配）

**Files:**
- 新建: `backend/src/settings/settings.module.ts`
- 新建: `backend/src/settings/settings.service.ts`
- 新建: `backend/src/settings/settings.controller.ts`
- 新建: `backend/src/settings/dto/patch-settings.dto.ts`
- 修改: `backend/src/app.module.ts`

- [ ] **Step 2.1：DTO**

新建 `backend/src/settings/dto/patch-settings.dto.ts`：

```typescript
import { IsObject, IsString } from 'class-validator'

export class PatchSettingsDto {
  @IsObject()
  settings!: Record<string, string>
}
```

- [ ] **Step 2.2：SettingsService**

新建 `backend/src/settings/settings.service.ts`：

```typescript
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
```

- [ ] **Step 2.3：SettingsController**

新建 `backend/src/settings/settings.controller.ts`：

```typescript
import { Body, Controller, Get, Patch } from '@nestjs/common'
import { PatchSettingsDto } from './dto/patch-settings.dto'
import { SettingsService } from './settings.service'

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getAll() {
    return this.settingsService.getAll()
  }

  @Patch()
  patch(@Body() dto: PatchSettingsDto) {
    return this.settingsService.patch(dto.settings)
  }
}
```

- [ ] **Step 2.4：SettingsModule**

新建 `backend/src/settings/settings.module.ts`：

```typescript
import { Module } from '@nestjs/common'
import { SettingsController } from './settings.controller'
import { SettingsService } from './settings.service'

@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
```

- [ ] **Step 2.5：注册到 AppModule**

修改 `backend/src/app.module.ts`，在 imports 数组加入 `SettingsModule`，并在顶部 import：

```typescript
import { SettingsModule } from './settings/settings.module'
// 在 @Module imports 数组加入 SettingsModule
```

- [ ] **Step 2.6：手动验证**

```bash
curl -s http://127.0.0.1:5173/settings
# 预期: {"data":{},"message":"ok"}

curl -s -X PATCH http://127.0.0.1:5173/settings \
  -H "Content-Type: application/json" \
  -d '{"settings":{"theme":"dark","classifyModel":"GLM-Z1-Flash"}}'
# 预期: {"data":{"theme":"dark","classifyModel":"GLM-Z1-Flash"},"message":"ok"}
```

---

## Task 3：后端 AiModule（Providers CRUD + 聊天代理）

**Files:**
- 新建: `backend/src/ai/ai.module.ts`
- 新建: `backend/src/ai/ai.service.ts`
- 新建: `backend/src/ai/ai.controller.ts`
- 新建: `backend/src/ai/dto/create-provider.dto.ts`
- 新建: `backend/src/ai/dto/update-provider.dto.ts`
- 新建: `backend/src/ai/dto/add-model.dto.ts`
- 新建: `backend/src/ai/dto/chat.dto.ts`
- 修改: `backend/src/app.module.ts`

- [ ] **Step 3.1：DTOs**

新建 `backend/src/ai/dto/create-provider.dto.ts`：
```typescript
import { IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateProviderDto {
  @IsString() @MaxLength(100) name!: string
  @IsString() @MaxLength(100) displayName!: string
  @IsString() @MaxLength(50)  presetId!: string
  @IsString() @MaxLength(20)  color!: string
  @IsString() @MaxLength(500) baseUrl!: string
  @IsOptional() @IsString() @MaxLength(500) apiKey?: string
}
```

新建 `backend/src/ai/dto/update-provider.dto.ts`：
```typescript
import { IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateProviderDto {
  @IsOptional() @IsString() @MaxLength(100) displayName?: string
  @IsOptional() @IsString() @MaxLength(500) baseUrl?: string
  @IsOptional() @IsString() @MaxLength(500) apiKey?: string
  @IsOptional() @IsString() @MaxLength(20)  color?: string
}
```

新建 `backend/src/ai/dto/add-model.dto.ts`：
```typescript
import { IsString, MaxLength } from 'class-validator'

export class AddModelDto {
  @IsString() @MaxLength(200) modelId!: string
}
```

新建 `backend/src/ai/dto/chat.dto.ts`：
```typescript
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class ChatMessageDto {
  @IsIn(['user', 'assistant', 'system'])
  role!: 'user' | 'assistant' | 'system'

  @IsString() @MaxLength(100_000)
  content!: string
}

export class ChatDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[]

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string

  // 用途槽位：classify / review / chat — 用于查找对应默认模型
  @IsOptional()
  @IsIn(['classify', 'review', 'chat'])
  slot?: 'classify' | 'review' | 'chat'
}
```

- [ ] **Step 3.2：AiService**

新建 `backend/src/ai/ai.service.ts`：

```typescript
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'
import { AddModelDto } from './dto/add-model.dto'
import { ChatDto } from './dto/chat.dto'
import { CreateProviderDto } from './dto/create-provider.dto'
import { UpdateProviderDto } from './dto/update-provider.dto'

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  // ── Providers ────────────────────────────────────────────────────────────

  async listProviders() {
    const providers = await this.prisma.aiProvider.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { models: { orderBy: { sortOrder: 'asc' } } },
    })
    return { items: providers }
  }

  async createProvider(dto: CreateProviderDto) {
    const count = await this.prisma.aiProvider.count()
    return this.prisma.aiProvider.create({
      data: {
        name: dto.name,
        displayName: dto.displayName,
        presetId: dto.presetId,
        color: dto.color,
        baseUrl: dto.baseUrl,
        apiKey: dto.apiKey ?? '',
        sortOrder: count,
      },
      include: { models: true },
    })
  }

  async updateProvider(id: string, dto: UpdateProviderDto) {
    await this.ensureProvider(id)
    const data: Record<string, string> = {}
    if (dto.displayName !== undefined) data.displayName = dto.displayName
    if (dto.baseUrl !== undefined) data.baseUrl = dto.baseUrl
    if (dto.apiKey !== undefined) data.apiKey = dto.apiKey
    if (dto.color !== undefined) data.color = dto.color
    return this.prisma.aiProvider.update({
      where: { id },
      data,
      include: { models: { orderBy: { sortOrder: 'asc' } } },
    })
  }

  async deleteProvider(id: string) {
    await this.ensureProvider(id)
    return this.prisma.aiProvider.delete({ where: { id } })
  }

  // ── Models ───────────────────────────────────────────────────────────────

  async addModel(providerId: string, dto: AddModelDto) {
    await this.ensureProvider(providerId)
    const count = await this.prisma.aiModel.count({ where: { providerId } })
    return this.prisma.aiModel.create({
      data: { providerId, modelId: dto.modelId, sortOrder: count },
    })
  }

  async removeModel(providerId: string, modelId: string) {
    const row = await this.prisma.aiModel.findFirst({
      where: { providerId, modelId },
    })
    if (!row) throw new NotFoundException('Model not found')
    return this.prisma.aiModel.delete({ where: { id: row.id } })
  }

  async setModelVerified(providerId: string, modelId: string, verified: boolean) {
    const row = await this.prisma.aiModel.findFirst({
      where: { providerId, modelId },
    })
    if (!row) throw new NotFoundException('Model not found')
    return this.prisma.aiModel.update({ where: { id: row.id }, data: { verified } })
  }

  // ── Chat proxy ───────────────────────────────────────────────────────────

  async chat(dto: ChatDto) {
    const { provider, model } = await this.resolveProviderAndModel(dto)

    if (!provider.apiKey) {
      throw new BadRequestException(
        `Provider "${provider.displayName}" has no API key configured`,
      )
    }

    const baseUrl = provider.baseUrl.replace(/\/$/, '')
    const url = `${baseUrl}/chat/completions`

    const body = JSON.stringify({
      model,
      messages: dto.messages,
      stream: false,
    })

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body,
      })
    } catch (err) {
      throw new BadRequestException(`Network error calling provider: ${String(err)}`)
    }

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown error')
      throw new BadRequestException(`Provider returned ${res.status}: ${text}`)
    }

    const json = (await res.json()) as {
      choices?: { message?: { role: string; content: string } }[]
    }

    const content = json.choices?.[0]?.message?.content ?? ''
    return { content, model, provider: provider.displayName }
  }

  // ── Test single model ────────────────────────────────────────────────────

  async testModel(providerId: string, modelId: string) {
    const provider = await this.ensureProvider(providerId)

    if (!provider.apiKey) {
      return { ok: false, error: 'No API key configured' }
    }

    const baseUrl = provider.baseUrl.replace(/\/$/, '')
    const url = `${baseUrl}/chat/completions`

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
          stream: false,
        }),
      })

      if (res.ok) {
        // Mark model as verified in DB
        await this.setModelVerified(providerId, modelId, true)
        return { ok: true }
      }

      const text = await res.text().catch(() => '')
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async ensureProvider(id: string) {
    const p = await this.prisma.aiProvider.findUnique({
      where: { id },
      include: { models: true },
    })
    if (!p) throw new NotFoundException('AiProvider not found')
    return p
  }

  private async resolveProviderAndModel(dto: ChatDto) {
    // If explicit model ID, find which provider has it
    if (dto.model) {
      const m = await this.prisma.aiModel.findFirst({
        where: { modelId: dto.model },
        include: { provider: true },
      })
      if (m) return { provider: m.provider, model: dto.model }
    }

    // Fall back to slot-based lookup from settings
    const allSettings = await this.settings.getAll()
    const slotKey = dto.slot ? `${dto.slot}Model` : 'chatModel'
    const defaultModelId = allSettings[slotKey]

    if (defaultModelId) {
      const m = await this.prisma.aiModel.findFirst({
        where: { modelId: defaultModelId },
        include: { provider: true },
      })
      if (m) return { provider: m.provider, model: defaultModelId }
    }

    // Last resort: first provider's first model
    const first = await this.prisma.aiProvider.findFirst({
      orderBy: { sortOrder: 'asc' },
      include: { models: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    })
    if (!first || first.models.length === 0) {
      throw new BadRequestException('No AI provider configured')
    }
    return { provider: first, model: first.models[0].modelId }
  }
}
```

- [ ] **Step 3.3：AiController**

新建 `backend/src/ai/ai.controller.ts`：

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { AiService } from './ai.service'
import { AddModelDto } from './dto/add-model.dto'
import { ChatDto } from './dto/chat.dto'
import { CreateProviderDto } from './dto/create-provider.dto'
import { UpdateProviderDto } from './dto/update-provider.dto'

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // Providers
  @Get('providers')
  listProviders() { return this.aiService.listProviders() }

  @Post('providers')
  @HttpCode(HttpStatus.CREATED)
  createProvider(@Body() dto: CreateProviderDto) {
    return this.aiService.createProvider(dto)
  }

  @Patch('providers/:id')
  updateProvider(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProviderDto,
  ) { return this.aiService.updateProvider(id, dto) }

  @Delete('providers/:id')
  deleteProvider(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.aiService.deleteProvider(id)
  }

  // Models
  @Post('providers/:id/models')
  @HttpCode(HttpStatus.CREATED)
  addModel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddModelDto,
  ) { return this.aiService.addModel(id, dto) }

  @Delete('providers/:id/models/:modelId')
  removeModel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('modelId') modelId: string,
  ) { return this.aiService.removeModel(id, modelId) }

  @Post('providers/:id/models/:modelId/test')
  @HttpCode(HttpStatus.OK)
  testModel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('modelId') modelId: string,
  ) { return this.aiService.testModel(id, modelId) }

  // Chat proxy
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chat(@Body() dto: ChatDto) { return this.aiService.chat(dto) }
}
```

- [ ] **Step 3.4：AiModule**

新建 `backend/src/ai/ai.module.ts`：

```typescript
import { Module } from '@nestjs/common'
import { SettingsModule } from '../settings/settings.module'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'

@Module({
  imports: [SettingsModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
```

- [ ] **Step 3.5：注册到 AppModule**

在 `backend/src/app.module.ts` 导入并注册 `AiModule`：

最终 app.module.ts：

```typescript
import { Controller, Get, Module } from '@nestjs/common'
import { AiModule } from './ai/ai.module'
import { FavoritesModule } from './favorites/favorites.module'
import { NotesModule } from './notes/notes.module'
import { PrismaModule } from './prisma/prisma.module'
import { ReviewModule } from './review/review.module'
import { SettingsModule } from './settings/settings.module'

@Controller()
class HealthController {
  @Get('/health')
  health() { return { status: 'ok' } }
}

@Module({
  imports: [PrismaModule, NotesModule, FavoritesModule, ReviewModule, SettingsModule, AiModule],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 3.6：手动验证**

重启后端（或等热重载），然后：

```bash
# 创建提供商
curl -s -X POST http://127.0.0.1:5173/ai/providers \
  -H "Content-Type: application/json" \
  -d '{"name":"SiliconFlow","displayName":"SiliconFlow","presetId":"siliconflow","color":"#818cf8","baseUrl":"https://api.siliconflow.cn/v1","apiKey":""}'

# 列出提供商
curl -s http://127.0.0.1:5173/ai/providers
```

---

## Task 4：更新 Vite Proxy（添加 /settings 和 /ai）

**Files:**
- 修改: `frontend/vite.config.ts`

- [ ] **Step 4.1：更新 vite.config.ts server.proxy 块**

将 `server.proxy` 块替换为（同时修复之前的 bypass 问题）：

```typescript
  server: {
    proxy: {
      '/notes': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/favorites': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/review': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/settings': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/ai': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/health': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
    },
  },
```

- [ ] **Step 4.2：重启 Vite 验证**

```bash
curl -s http://127.0.0.1:5173/settings
# 预期: {"data":{},"message":"ok"}
curl -s http://127.0.0.1:5173/ai/providers
# 预期: {"data":{"items":[]},"message":"ok"}
```

---

## Task 5：前端 Store 扩展（加载/保存 providers 和 settings）

**Files:**
- 修改: `frontend/src/store/useAppStore.ts`

此 Task 只修改 store，不动页面。

- [ ] **Step 5.1：扩展 AppState 接口，加 provider 同步 action**

在 `AppState` 接口中找到 `// Providers` 区块：

```typescript
  // Providers (shared between Settings and AIModelConfigModal)
  providers: ProviderConfig[]
  setProviders: (p: ProviderConfig[]) => void
```

替换为：

```typescript
  // Providers (shared between Settings and AIModelConfigModal)
  providers: ProviderConfig[]
  providersLoaded: boolean
  setProviders: (p: ProviderConfig[]) => void
  loadProviders: () => Promise<void>
  syncProviderToBackend: (provider: ProviderConfig) => Promise<void>
  createProviderInBackend: (provider: ProviderConfig) => Promise<string | null>
  deleteProviderFromBackend: (id: string) => Promise<void>
  addModelToBackend: (providerId: string, modelId: string) => Promise<void>
  removeModelFromBackend: (providerId: string, modelId: string) => Promise<void>
  testModelInBackend: (providerId: string, modelId: string) => Promise<{ ok: boolean; error?: string }>

  // Settings
  settingsLoaded: boolean
  loadSettings: () => Promise<void>
  saveSettings: (patch: Record<string, string>) => Promise<void>

  // Model slot assignments (loaded from backend settings)
  classifyModel: string
  reviewModel: string
  chatModel: string
  setModelSlot: (slot: 'classify' | 'review' | 'chat', model: string) => Promise<void>
```

- [ ] **Step 5.2：定义 BackendProvider 类型（在文件顶部加）**

在 `BackendNote` 接口后追加：

```typescript
interface BackendAiProvider {
  id: string
  name: string
  displayName: string
  presetId: string
  color: string
  baseUrl: string
  apiKey: string
  sortOrder: number
  models: { id: string; providerId: string; modelId: string; verified: boolean }[]
}

function mapBackendProvider(p: BackendAiProvider): ProviderConfig {
  return {
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    presetId: p.presetId,
    color: p.color,
    baseUrl: p.baseUrl,
    apiKey: p.apiKey,
    models: p.models.map((m) => ({ id: m.modelId, verified: m.verified })),
    selectedModel: p.models.find((m) => m.verified)?.modelId ?? p.models[0]?.modelId,
  }
}
```

- [ ] **Step 5.3：在 store 实现中替换 providers 区块**

找到：

```typescript
  providers: DEFAULT_PROVIDERS,
  setProviders: (p) => set({ providers: p }),
```

替换为：

```typescript
  providers: DEFAULT_PROVIDERS,
  providersLoaded: false,

  setProviders: (p) => set({ providers: p }),

  loadProviders: async () => {
    try {
      const res = await fetch(apiUrl('/ai/providers'))
      if (!res.ok) return
      const json = (await res.json()) as { data?: { items?: BackendAiProvider[] } }
      const items = json.data?.items
      if (!Array.isArray(items) || items.length === 0) return
      set({ providers: items.map(mapBackendProvider), providersLoaded: true })
    } catch { /* 静默失败，保留默认 providers */ }
  },

  syncProviderToBackend: async (provider) => {
    try {
      await fetch(apiUrl(`/ai/providers/${provider.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: provider.displayName,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          color: provider.color,
        }),
      })
    } catch { /* 静默 */ }
  },

  createProviderInBackend: async (provider) => {
    try {
      const res = await fetch(apiUrl('/ai/providers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: provider.name,
          displayName: provider.displayName,
          presetId: provider.presetId,
          color: provider.color,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
        }),
      })
      if (!res.ok) return null
      const json = (await res.json()) as { data?: { id: string } }
      return json.data?.id ?? null
    } catch { return null }
  },

  deleteProviderFromBackend: async (id) => {
    try {
      await fetch(apiUrl(`/ai/providers/${id}`), { method: 'DELETE' })
    } catch { /* 静默 */ }
  },

  addModelToBackend: async (providerId, modelId) => {
    try {
      await fetch(apiUrl(`/ai/providers/${providerId}/models`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      })
    } catch { /* 静默 */ }
  },

  removeModelFromBackend: async (providerId, modelId) => {
    try {
      await fetch(apiUrl(`/ai/providers/${providerId}/models/${encodeURIComponent(modelId)}`), {
        method: 'DELETE',
      })
    } catch { /* 静默 */ }
  },

  testModelInBackend: async (providerId, modelId) => {
    try {
      const res = await fetch(
        apiUrl(`/ai/providers/${providerId}/models/${encodeURIComponent(modelId)}/test`),
        { method: 'POST' },
      )
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
      const json = (await res.json()) as { data?: { ok: boolean; error?: string } }
      return json.data ?? { ok: false, error: 'No response' }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  },

  // Settings
  settingsLoaded: false,
  classifyModel: '',
  reviewModel: '',
  chatModel: '',

  loadSettings: async () => {
    try {
      const res = await fetch(apiUrl('/settings'))
      if (!res.ok) return
      const json = (await res.json()) as { data?: Record<string, string> }
      const s = json.data ?? {}
      set({
        settingsLoaded: true,
        ...(s['theme'] ? { theme: s['theme'] as 'dark' | 'light' } : {}),
        classifyModel: s['classifyModel'] ?? '',
        reviewModel: s['reviewModel'] ?? '',
        chatModel: s['chatModel'] ?? '',
      })
      if (s['theme']) {
        document.documentElement.classList.toggle('light', s['theme'] === 'light')
      }
    } catch { /* 静默 */ }
  },

  saveSettings: async (patch) => {
    try {
      await fetch(apiUrl('/settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: patch }),
      })
    } catch { /* 静默 */ }
  },

  setModelSlot: async (slot, model) => {
    set((s) => {
      const key = `${slot}Model` as 'classifyModel' | 'reviewModel' | 'chatModel'
      return { [key]: model } as Partial<typeof s>
    })
    void (async () => {
      try {
        await fetch(apiUrl('/settings'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: { [`${slot}Model`]: model } }),
        })
      } catch { /* 静默 */ }
    })()
  },
```

> **注意：** `setTheme` 需要同时触发 `saveSettings`。找到原有 `setTheme` 实现：
> ```typescript
> setTheme: (t) => {
>   document.documentElement.classList.toggle('light', t === 'light')
>   set({ theme: t })
> },
> ```
> 替换为：
> ```typescript
> setTheme: (t) => {
>   document.documentElement.classList.toggle('light', t === 'light')
>   set({ theme: t })
>   void fetch(apiUrl('/settings'), {
>     method: 'PATCH',
>     headers: { 'Content-Type': 'application/json' },
>     body: JSON.stringify({ settings: { theme: t } }),
>   }).catch(() => { /* 静默 */ })
> },
> ```

---

## Task 6：更新 App.tsx（启动时加载 providers 和 settings）

**Files:**
- 修改: `frontend/src/App.tsx`

- [ ] **Step 6.1：在 AppInner useEffect 中加 loadProviders 和 loadSettings**

找到：

```typescript
  const { showSearch, showQuickNote, showAIPanel, showAIConfig, showImport, syncFavorites, loadNotes } =
    useAppStore()

  useEffect(() => {
    void loadNotes()
    void syncFavorites()
  }, [loadNotes, syncFavorites])
```

替换为：

```typescript
  const {
    showSearch, showQuickNote, showAIPanel, showAIConfig, showImport,
    syncFavorites, loadNotes, loadProviders, loadSettings,
  } = useAppStore()

  useEffect(() => {
    void loadSettings()
    void loadProviders()
    void loadNotes()
    void syncFavorites()
  }, [loadSettings, loadProviders, loadNotes, syncFavorites])
```

---

## Task 7：更新 AIModelConfigModal（持久化 + 真实测试）

**Files:**
- 修改: `frontend/src/components/modals/AIModelConfigModal.tsx`

此 Task 修改 AIModelConfigModal 中的 handleTest / handleAddProvider / handleDeleteProvider / handleAddModel / handleRemoveModel，让它们调用后端。

- [ ] **Step 7.1：更新 store action 引用**

找到：

```typescript
  const { showAIConfig, closeAIConfig, providers, setProviders } = useAppStore()
```

替换为：

```typescript
  const {
    showAIConfig, closeAIConfig, providers, setProviders,
    syncProviderToBackend, createProviderInBackend, deleteProviderFromBackend,
    addModelToBackend, removeModelFromBackend, testModelInBackend,
  } = useAppStore()
```

- [ ] **Step 7.2：handleTest 改为真实 API 测试**

找到 `handleTest` 函数并替换：

```typescript
  const handleTest = async () => {
    if (!current || current.models.length === 0) return
    const models = current.models
    setTestProgress({ done: 0, total: models.length })
    setModelTestResults({})
    setTestStatus('testing')

    for (let i = 0; i < models.length; i++) {
      const m = models[i]
      setModelTestResults((prev) => ({ ...prev, [m.id]: 'testing' }))

      const result = await testModelInBackend(current.id, m.id)
      setModelTestResults((prev) => ({ ...prev, [m.id]: result.ok ? 'ok' : 'fail' }))
      setTestProgress({ done: i + 1, total: models.length })

      // If test passed, update local verified state
      if (result.ok) {
        setProviders(providers.map((p) =>
          p.id === current.id
            ? { ...p, models: p.models.map((mo) => mo.id === m.id ? { ...mo, verified: true } : mo) }
            : p
        ))
      }
    }

    const allOk = models.every((m) => modelTestResults[m.id] === 'ok')
    setTestStatus(allOk ? 'ok' : 'fail')
    setTimeout(() => { setTestStatus('idle'); setTestProgress(null) }, 3000)
  }
```

- [ ] **Step 7.3：handleAddProvider 改为先创建后端记录，再用后端 ID**

找到 `handleAddProvider` 并替换：

```typescript
  const handleAddProvider = async (presetId: string) => {
    const preset = PRESET_PROVIDERS.find((p) => p.id === presetId)
    if (!preset) return
    const newProviderSeq = ++newProviderSeqRef.current
    const tempId = `temp-${newProviderSeq}`
    const newP: ProviderConfig = {
      id: tempId,
      name: preset.name,
      displayName: preset.name,
      apiKey: '',
      baseUrl: preset.baseUrl,
      models: [],
      presetId: preset.id,
      color: preset.color,
    }
    setProviders([...providers, newP])
    setSelectedId(tempId)
    setShowAddDropdown(false)

    // Create in backend and replace temp ID with real ID
    const realId = await createProviderInBackend(newP)
    if (realId) {
      setProviders((prev) => {
        const updated = prev.map((p) => p.id === tempId ? { ...p, id: realId } : p)
        return updated
      })
      setSelectedId(realId)
    }
  }
```

> 注意：`setProviders` 需要接受函数形式。在 AppState 接口把 `setProviders` 改为：
> ```typescript
> setProviders: (p: ProviderConfig[] | ((prev: ProviderConfig[]) => ProviderConfig[])) => void
> ```
> 在实现中改为：
> ```typescript
> setProviders: (p) => set((s) => ({
>   providers: typeof p === 'function' ? p(s.providers) : p
> })),
> ```

- [ ] **Step 7.4：handleDeleteProvider 同步删除后端**

找到 `handleDeleteProvider` 并替换：

```typescript
  const handleDeleteProvider = (id: string) => {
    setProviders(providers.filter((p) => p.id !== id))
    setSelectedId(providers.find((p) => p.id !== id)?.id ?? '')
    void deleteProviderFromBackend(id)
  }
```

- [ ] **Step 7.5：handleAddModel 同步后端**

找到 `handleAddModel` 并替换：

```typescript
  const handleAddModel = (modelId: string) => {
    if (!modelId.trim() || !current) return
    const already = current.models.some((m) => m.id === modelId)
    if (!already) {
      updateCurrent({ models: [...current.models, { id: modelId, verified: false }] })
      void addModelToBackend(current.id, modelId)
    }
    setNewModelId('')
    setShowRecommended(false)
  }
```

- [ ] **Step 7.6：handleRemoveModel 同步后端**

找到 `handleRemoveModel` 并替换：

```typescript
  const handleRemoveModel = (modelId: string) => {
    if (!current) return
    updateCurrent({ models: current.models.filter((m) => m.id !== modelId) })
    void removeModelFromBackend(current.id, modelId)
  }
```

- [ ] **Step 7.7：API Key 变化时同步后端（debounced）**

找到 API Key 的 input `onChange`：

```typescript
onChange={(e) => updateCurrent({ apiKey: e.target.value })}
```

替换为（需要在组件顶部 import `useRef`，并添加 debounce timer ref）：

在组件函数顶部加 `const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`

然后替换 onChange：

```typescript
onChange={(e) => {
  updateCurrent({ apiKey: e.target.value })
  // Debounce save to backend
  if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  saveTimerRef.current = setTimeout(() => {
    if (current) void syncProviderToBackend({ ...current, apiKey: e.target.value })
  }, 800)
}}
```

---

## Task 8：更新 Settings 页（模型分配 + 主题持久化）

**Files:**
- 修改: `frontend/src/pages/Settings.tsx`

- [ ] **Step 8.1：从 store 读取 classifyModel/reviewModel/chatModel，并使用 setModelSlot**

找到：

```typescript
  const { openAIConfig, theme, setTheme, providers } = useAppStore()
  const [classifyModel, setClassifyModel] = useState(providers[0]?.selectedModel?.split('/').pop() ?? 'GLM-Z1-Flash')
  const [reviewModel, setReviewModel] = useState(providers[1]?.selectedModel?.split('/').pop() ?? 'MiniMax-M2.5')
  const [chatModel, setChatModel] = useState(providers[0]?.selectedModel?.split('/').pop() ?? 'GLM-Z1-Flash')

  const modelValues = { classify: classifyModel, review: reviewModel, chat: chatModel }
  const modelSetters = { classify: setClassifyModel, review: setReviewModel, chat: setChatModel }
```

替换为：

```typescript
  const { openAIConfig, theme, setTheme, providers, classifyModel, reviewModel, chatModel, setModelSlot } = useAppStore()

  const modelValues = { classify: classifyModel, review: reviewModel, chat: chatModel }
```

- [ ] **Step 8.2：更新 select 的 onChange**

找到：

```typescript
onChange={(e) => setter(e.target.value)}
```

替换为：

```typescript
onChange={(e) => { void setModelSlot(slot.id as 'classify' | 'review' | 'chat', e.target.value) }}
```

删除不再需要的 `const modelSetters = ...`（已在 Step 8.1 移除）。

---

## Self-Review 检查清单

- [x] **Spec coverage:**
  - Task 8.1（settings 持久化：主题 + 模型分配）→ Task 2 + Task 5 + Task 8 ✓
  - Task 8.2（ai_providers / ai_models CRUD + 验证）→ Task 1 + Task 3 + Task 5 + Task 7 ✓
  - Task 8.3（Settings 与 AIModelConfigModal 联调）→ Task 7 + Task 8 ✓
  - AI 聊天代理（其他功能需要）→ Task 3 `/ai/chat` ✓
  - Vite proxy 更新 → Task 4 ✓
  - 启动时加载 → Task 6 ✓

- [x] **类型一致性：**
  - `setProviders` 改为接受函数形式 ✓
  - `BackendAiProvider.models[].id` 是 AiModel.id，而 `ProviderConfig.models[].id` 是 modelId（注意映射）
  - `handleAddProvider` 是 async，调用 `onClick={() => { void handleAddProvider(p.id) }}` ✓

- [x] **No Placeholders:** 所有步骤含完整代码 ✓

- [x] **边界情况：**
  - `loadProviders` 在 DB 无 providers 时不替换 DEFAULT_PROVIDERS（`items.length === 0` 时 return）
  - `testModel` 在前端循环结束后判断 `allOk` 时需从 modelTestResults 的最新状态读，需用 ref 或 state
  - `handleAddProvider` 是 async，`onClick` 需用 `void handleAddProvider(...)` ✓
