import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "src/generated/prisma/client";

  //！！ MCP Server 是独立进程，需要自己初始化 Prisma
  // Prisma 7 必须通过 adapter 连接数据库
  // 第一步：创建 pg 连接池（Pool 负责管理数据库连接）
  const pool=new Pool({
    connectionString: process.env.DATABASE_URL,
  })
  // 第二步：把 pool 包装成 Prisma 认识的 adapter
  const adapter = new PrismaPg(pool)
  //第三步： 创建 Prisma 数据库客户端实例，用它操作数据库
  const prismaService = new PrismaClient({
    adapter,
  })

  export async function searchUsers(query) {
    const { page = '1', pageSize = '10', name, role } = query;
   
    const skip = (parseInt(page) - 1) * parseInt(pageSize);

    const take = parseInt(pageSize);

    const where: any = {};
    if (name) {
      where.name = { contains: name, mode: 'insensitive' }; // 模糊搜索，忽略大小写
    }
    if (role) {
      where.role = role;
    }
    const [total, users] = await prismaService.$transaction([
      prismaService.user.count({ where }), // 获取总记录数 
      prismaService.user.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }), // 获取分页数据
    ]);
    const totalPage = Math.ceil(total / take);
    return {
      pagination: {
        total, // 总记录数
        totalPage, // 总页数
        currentPage: parseInt(page), // 当前页码
        pageSize: take, // 每页记录数
        hasNextPage: parseInt(page) < totalPage, // 是否有下一页
        hasPreviousPage: parseInt(page) > 1, // 是否有上一页
      },
      data: users.map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      })), // 当前页数据
    };
  }

