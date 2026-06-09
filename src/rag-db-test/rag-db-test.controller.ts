import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { RagDbTestService } from './rag-db-test.service';

@Controller('rag-db-test')
export class RagDbTestController {
    constructor(private readonly ragDbTestService: RagDbTestService) { }

    @Post('load')
    load(@Body() body: { documents: { id: string; content: string; source?: string }[] }) {
        return this.ragDbTestService.load(body.documents);
    }
    
    @Post('query')
    query(@Body() body: { question: string; topK: number }) {
        return this.ragDbTestService.query(body.question, body.topK);
    }

    @Post('search')
    search(@Body() body: {query:string; topK?:number}) {
        return this.ragDbTestService.search(body.query,body.topK);
    }

    @Delete('clear')
    clearKnowledage() {
        return this.ragDbTestService.clearKnowledage()
    }

    @Get('status')
    getStatus() {
        return this.ragDbTestService.getStatus();
    }
}
