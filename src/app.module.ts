import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TestController } from './test/testController';
import { TestService } from './test/testService';
import { DemoModule } from './demo/demo.module';
import { ConfigModule } from '@nestjs/config';
// import { UserController } from './user/user.controller';
// import { UserService } from './user/user.service';
import { UserModule } from './user/user.module';
import { OrderModule } from './order/order.module';
import { PrismaModule } from './prisma/prisma.module';
import { PostModule } from './post/post.module';
import { ModelsModule } from './models/models.module';
import { PromptsModule } from './prompts/prompts.module';
import { ChainsModule } from './chains/chains.module';
import { AgentsModule } from './agents/agents.module';
import { MemoryModule } from './memory/memory.module';
import { RagModule } from './rag/rag.module';
import { FunctionCallingModule } from './function-calling/function-calling.module';
import { RagDbModule } from './rag-db/rag-db.module';
import { FunctionCallingTestModule } from './function-calling-test/function-calling-test.module';
import { RagTestModule } from './rag-test/rag-test.module';
import { RagDbTestModule } from './rag-db-test/rag-db-test.module';
import { RagDbChromaTestModule } from './rag-db-chroma-test/rag-db-chroma-test.module';
import { McpClientModule } from './mcp-client/mcp-client.module';
import { McpAgentModule } from './mcp-agent/mcp-agent.module';
import { EmbedModule } from './embed/embed.module';
import { LanggraphModule } from './langgraph/langgraph.module';
import { TechResearchModule } from './tech-research/tech-research.module';

@Module({
  imports: [DemoModule, UserModule, OrderModule, PrismaModule, PostModule,
    ConfigModule.forRoot({
      isGlobal: true, // 👈 关键
    }),
    ModelsModule,
    PromptsModule,
    ChainsModule,
    AgentsModule,
    MemoryModule,
    RagModule,
    FunctionCallingModule,
    RagDbModule,
    FunctionCallingTestModule,
    RagTestModule,
    RagDbTestModule,
    RagDbChromaTestModule,
    McpClientModule,
    McpAgentModule,
    EmbedModule,
    LanggraphModule,
    TechResearchModule,],
  controllers: [AppController, TestController],
  providers: [AppService, TestService,],
})
export class AppModule {}
