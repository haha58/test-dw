import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LanggraphService } from './langgraph.service';

@Controller('langgraph')
export class LanggraphController {
    constructor(private readonly langgraphService: LanggraphService) {}

    @Post('simple-chat')
    simpleChat(@Body() body: { message: string }) {
      return this.langgraphService.simpleChat(body.message);
    }

    @Post('memory-chat/:threadId')
    memoryChat(@Param('threadId') threadId: string, @Body() body: { message: string }) {
      return this.langgraphService.memoryChat(threadId, body.message);
    }

    @Get('memory-chat/:threadId/history')
    getHistory(@Param('threadId') threadId: string) {
      return this.langgraphService.getHistory(threadId);
    }
}
