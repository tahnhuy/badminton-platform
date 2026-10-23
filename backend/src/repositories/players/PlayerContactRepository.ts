import { eq } from 'drizzle-orm';
import { db, playerProfiles } from '../../db';
export const playerContactRepository = {
  async find(userId: number) {
    const [row] = await db.select({ phone: playerProfiles.phone }).from(playerProfiles).where(eq(playerProfiles.userId, userId));
    return row ?? null;
  },
  async update(userId: number, phone: string | null) {
    const [row] = await db.update(playerProfiles).set({ phone, updatedAt: new Date() }).where(eq(playerProfiles.userId, userId)).returning({ phone: playerProfiles.phone });
    return row ?? null;
  },
};
