import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common'
import { ToggleFavoriteDto } from './dto/toggle-favorite.dto'
import { FavoritesService } from './favorites.service'

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.favoritesService.list(search)
  }

  @Post('toggle')
  @HttpCode(HttpStatus.OK)
  toggle(@Body() dto: ToggleFavoriteDto) {
    return this.favoritesService.toggle(dto.noteId)
  }
}
