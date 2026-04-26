import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from "@/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL!;

const global = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = 
    global.prisma ??
    new PrismaClient({
        adapter: new PrismaPg({ connectionString }),
    });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;

export default prisma;
