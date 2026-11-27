import { eq } from 'drizzle-orm';
import { db, courtOwnerProfiles } from '../../db';
const columns = { businessName: courtOwnerProfiles.businessName, phone: courtOwnerProfiles.phone, updatedAt: courtOwnerProfiles.updatedAt };
export const ownerProfileRepository = {
  async find(userId: number) {
    const [row] = await db.select(columns).from(courtOwnerProfiles).where(eq(courtOwnerProfiles.userId, userId));
    return row ?? null;
  },
  async updatePhone(userId: number, phone: string) {
    const [row] = await db.update(courtOwnerProfiles).set({ phone, updatedAt: new Date() }).where(eq(courtOwnerProfiles.userId, userId)).returning(columns);
    return row ?? null;
  },
};
