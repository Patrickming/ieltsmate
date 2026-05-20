import { Module } from '@nestjs/common'
import { DictionaryController } from './dictionary.controller'
import { FreeDictionaryApiService } from './free-dictionary-api.service'

@Module({
  controllers: [DictionaryController],
  providers: [FreeDictionaryApiService],
  exports: [FreeDictionaryApiService],
})
export class DictionaryModule {}
