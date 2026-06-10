import { Body, Controller, Get, Post } from '@nestjs/common';
import { McpClientService } from './mcp-client.service';

@Controller('mcp-client')
export class McpClientController {
    constructor(private readonly mcpClient: McpClientService) {}        

    @Get('tool-list')
    async getToolList() {
        return this.mcpClient.getToolList();
    }

    @Post('call')
    async callTool(@Body() body: { toolName: string, args: Record<string, unknown> }) {
        return this.mcpClient.callTool(body.toolName, body.args);
    }
}
