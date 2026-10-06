import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Resolve the SQLite file absolutely — the relative URL in .env is anchored
// to the prisma/ dir for the CLI, but the runtime resolves against cwd.
const datasourceUrl =
  process.env.DATABASE_URL && path.isAbsolute(process.env.DATABASE_URL.slice(5))
    ? process.env.DATABASE_URL
    : `file:${path.join(process.cwd(), "prisma", "dev.db")}`;

export const db =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
