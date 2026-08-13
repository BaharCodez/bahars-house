import "server-only";
import { prisma } from "./prisma";

// Keys used by the house's little settings table.
export const LEETCODE_USER = "leetcode.username";
export const LEETCODE_SYNCED_AT = "leetcode.syncedAt";

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function clearSetting(key: string) {
  await prisma.setting.deleteMany({ where: { key } });
}
