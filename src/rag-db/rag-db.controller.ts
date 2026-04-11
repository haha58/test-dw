import { Body, Controller,Delete,Get,Post } from '@nestjs/common';
import { RagDbService } from './rag-db.service';
@Controller('rag-db')
export class RagDbController {

    constructor (private readonly ragService: RagDbService) {} 
    
    
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
        clearKnowledage() {
            return this.ragService.clearKnowledage()
        }
}
