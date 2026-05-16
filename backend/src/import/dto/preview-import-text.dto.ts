import { IsString } from 'class-validator'

/** 粘贴导入预览：JSON Body，不走 multipart，避免仅有 markdown 字段时 Multer 行为不一致 */
export class PreviewImportTextDto {
  @IsString()
  markdown!: string
}
