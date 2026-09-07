import { config } from "dotenv";
import "server-only";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: ".env.local" });
config();

// Prisma 7 connects through a driver adapter rather than a schema `url`.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

// Reuse one client across hot reloads in dev so we don't exhaust connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
