import { Injectable, NotFoundException } from '@nestjs/common'
import { join, basename } from 'path'
import * as fs from 'fs'

export const ALLOWED_IDS = ['大作文', '小作文'] as const
type WritingId = (typeof ALLOWED_IDS)[number]

export function getNotesRoot(): string {
  if (process.env.NOTES_ROOT) return process.env.NOTES_ROOT
  // ts-node dev: __dirname = backend/src/writing/，往上三层到仓库根，再进 笔记/
  return join(__dirname, '../../../笔记')
}

export interface WritingNoteItem {
  id: string
  name: string
  path: string
  writingType: '大作文' | '小作文'
  updatedAt: string
}

export interface WritingNoteDetail extends WritingNoteItem {
  content: string
}

@Injectable()
export class WritingService {
  private resolveMdFile(id: WritingId): string {
    const dir = join(getNotesRoot(), '写作笔记', id)
    if (!fs.existsSync(dir)) throw new NotFoundException(`写作目录不存在：${id}`)
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .sort()
    if (files.length === 0) throw new NotFoundException(`目录中未找到 .md 文件：${id}`)
    return join(dir, files[0])
  }

  list(): WritingNoteItem[] {
    return ALLOWED_IDS.flatMap((id) => {
      try {
        const filePath = this.resolveMdFile(id)
        const stat = fs.statSync(filePath)
        const name = basename(filePath)
        return [
          {
            id,
            name,
            path: `笔记/写作笔记/${id}/${name}`,
            writingType: id,
            updatedAt: stat.mtime.toISOString(),
          },
        ]
      } catch (e) {
        if (e instanceof NotFoundException) return []
        throw e
      }
    })
  }

  findOne(id: string): WritingNoteDetail {
    if (!ALLOWED_IDS.includes(id as WritingId)) {
      throw new NotFoundException(`写作笔记不存在：${id}`)
    }
    const safeId = id as WritingId
    const filePath = this.resolveMdFile(safeId)
    const stat = fs.statSync(filePath)
    const name = basename(filePath)
    let content = fs.readFileSync(filePath, 'utf-8')
    // 替换相对图片路径为可访问的绝对路径
    content = content.replace(
      /\.\/assets\//g,
      `/writing-assets/写作笔记/${safeId}/assets/`,
    )
    return {
      id: safeId,
      name,
      path: `笔记/写作笔记/${safeId}/${name}`,
      writingType: safeId,
      updatedAt: stat.mtime.toISOString(),
      content,
    }
  }
}
