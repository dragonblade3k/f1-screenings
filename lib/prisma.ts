import { PrismaClient } from "@prisma/client";

console.log("DATABASE_URL =", process.env.DATABASE_URL);


const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: []
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
