import { Body, Controller, Get, Post } from '@nestjs/common';
import { McpAgentService } from './mcp-agent.service';

@Controller('mcp-agent')
export class McpAgentController {
    constructor(private readonly mcpAgentService: McpAgentService) {}

    @Get('tool-list')
    async getToolList() {
        return this.mcpAgentService.getToolList();
    }

    @Post('run')
    runAgent(@Body() body: { message: string }) {
      return this.mcpAgentService.runAgent(body.message)
    }
}
