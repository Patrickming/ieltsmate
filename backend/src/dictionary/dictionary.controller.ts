import { Controller, Get, NotFoundException, Param } from '@nestjs/common'
import { FreeDictionaryApiService } from './free-dictionary-api.service'

@Controller('dictionary')
export class DictionaryController {
  constructor(private readonly dictionary: FreeDictionaryApiService) {}

  /**
   * 仅返回音标与发音音频（优先英式）。
   * 上游：api.freedictionaryapi.com；音频不足时合并 api.dictionaryapi.dev。
   */
  @Get('pronunciation/:word')
  async pronunciation(@Param('word') word: string) {
    const uk = await this.dictionary.lookupBritishPronunciation(word)
    if (!uk) {
      throw new NotFoundException(`未找到英式音标或发音：${word}`)
    }
    return uk
  }
}
