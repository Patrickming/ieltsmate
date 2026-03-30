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

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chat(@Body() dto: ChatDto) { return this.aiService.chat(dto) }
}
