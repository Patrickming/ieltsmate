import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'

const MIME_TO_EXT: Record<string, string> = {
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}
const PUBLIC_PREFIX = '/note-user-images/'

@Injectable()
export class NoteUserImageStorage {
  private readonly logger = new Logger(NoteUserImageStorage.name)
  private readonly root = resolve(
    process.env.NOTE_USER_IMAGE_ROOT ?? join(process.cwd(), 'uploads', 'note-user-images'),
  )

  async saveMany(files: Express.Multer.File[]) {
    const validFiles = files.filter((file) => file?.buffer?.length)

    for (const file of validFiles) {
      if (!(file.mimetype in MIME_TO_EXT)) {
        throw new BadRequestException(`不支持的图片类型: ${file.mimetype ?? 'unknown'}`)
      }
    }

    const now = new Date()
    const year = String(now.getFullYear())
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const dir = join(this.root, year, month)
    await mkdir(dir, { recursive: true })

    const results: string[] = []
    try {
      for (const file of validFiles) {
        const fallbackExt = extname(file.originalname) || '.bin'
        const ext = MIME_TO_EXT[file.mimetype] ?? fallbackExt
        const filename = `${randomUUID()}${ext}`
        await writeFile(join(dir, filename), file.buffer)
        results.push(`${PUBLIC_PREFIX}${year}/${month}/${filename}`)
      }
    } catch (error) {
      if (results.length > 0) {
        try {
          await this.removeMany(results)
        } catch (cleanupError) {
          this.logger.warn(`回滚备注图片文件失败: ${this.describeError(cleanupError)}`)
        }
      }
      throw error
    }

    return results
  }

  async removeMany(paths: string[]) {
    await Promise.all(
      paths.map(async (publicPath) => {
        const target = this.resolveRemovalTarget(publicPath)
        if (!target) {
          return
        }
        await rm(target, { force: true })
      }),
    )
  }

  private resolveRemovalTarget(publicPath: string) {
    if (!publicPath.startsWith(PUBLIC_PREFIX)) {
      this.logger.warn(`忽略非备注图片路径删除请求: ${publicPath}`)
      return null
    }

    const relativePath = publicPath.slice(PUBLIC_PREFIX.length)
    if (!relativePath) {
      this.logger.warn('忽略空备注图片路径删除请求')
      return null
    }

    const target = resolve(this.root, relativePath)
    const relativeToRoot = relative(this.root, target)
    if (!relativeToRoot || relativeToRoot.startsWith('..') || isAbsolute(relativeToRoot)) {
      this.logger.warn(`忽略越界备注图片路径删除请求: ${publicPath}`)
      return null
    }

    return target
  }

  private describeError(error: unknown) {
    if (error instanceof Error) {
      return error.message
    }
    return String(error)
  }
}
