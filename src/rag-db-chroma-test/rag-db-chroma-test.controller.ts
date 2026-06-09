import { Body, Controller,Delete,Get,Post } from '@nestjs/common';
import { RagDbChromaTestService } from './rag-db-chroma-test.service';
@Controller('rag-db-chroma-test')
export class RagDbChromaTestController {

    constructor (private readonly ragService: RagDbChromaTestService) {} 
    
    @Post('load')
    loadDocuments (@Body() body: {documents: {id: string; content:string; source?: string}[]}) {
        return this.ragService.loadDocuments(body.documents);

    }
    @Get('status')
    getStatus() {
        return this.ragService.getStatus();
    }
    //  纯向量查询， （不通过大模型 直接看检索的结果）
    @Post('search')
    search(@Body() body: {query:string; topK?:number}) {
        return this.ragService.search(body.query,body.topK);
    }
    @Post('query')
    query(@Body() body: {question:string; topK?:number}) {
        return this.ragService.query(body.question,body.topK);
    }
    @Delete('clear')
    clearKnowledge() {
        return this.ragService.clearKnowledge()
    }
}
