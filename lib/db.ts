import { PrismaClient } from "@prisma/client";

// Next.js hot-reloads server modules in dev; keep one client on globalThis so we
// don't open a new SQLite connection on every reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
