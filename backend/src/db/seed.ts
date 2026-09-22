import * as dotenv from 'dotenv';
dotenv.config();

import { db, pool } from './index';
import { users, skillLevels, playerProfiles, courtOwnerProfiles } from './schema';
import { hashPassword } from '../utils/password';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Starting database seeding for Badminton Platform...');

  try {
    // 1. Seed Skill Levels (if not already seeded)
    console.log('🏸 Seeding skill levels...');
    const defaultSkillLevels = [
      { code: 'BEGINNER', name: 'Mới chơi (Beginner)', rank: 1, description: 'Người mới tập chơi, nắm cơ bản luật và động tác.' },
      { code: 'INTERMEDIATE', name: 'Trung bình (Intermediate)', rank: 2, description: 'Chơi phong trào thường xuyên, phản xạ và thể lực tốt.' },
      { code: 'ADVANCED', name: 'Khá / Bán chuyên (Advanced)', rank: 3, description: 'Kỹ thuật hoàn thiện, thường tham gia các giải phong trào.' },
      { code: 'PRO', name: 'Chuyên nghiệp (Professional)', rank: 4, description: 'VĐV thi đấu các giải cấp tỉnh, quốc gia hoặc BWF.' },
    ];

    for (const level of defaultSkillLevels) {
      const existing = await db
        .select()
        .from(skillLevels)
        .where(eq(skillLevels.code, level.code))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(skillLevels).values(level);
        console.log(`  + Inserted skill level: ${level.name}`);
      }
    }

    // Fetch existing skill levels to reference IDs
    const dbSkills = await db.select().from(skillLevels);
    const skillMap = new Map(dbSkills.map((s) => [s.code, s.id]));

    // Common default password for seed users
    const defaultPassword = 'Password@123';
    const hashedPassword = await hashPassword(defaultPassword);

    // 2. Seed Admin User
    console.log('👑 Seeding Admin accounts...');
    const adminEmail = 'admin@smashpro.vn';
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (existingAdmin.length === 0) {
      await db.insert(users).values({
        email: adminEmail,
        passwordHash: hashedPassword,
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      console.log(`  + Inserted Admin: ${adminEmail} (password: ${defaultPassword})`);
    } else {
      console.log(`  ℹ Admin ${adminEmail} already exists.`);
    }

    // 3. Seed Court Owners
    console.log('🏢 Seeding Court Owner accounts...');
    const courtOwners = [
      {
        email: 'quocbao.tran@phucthinhbadminton.vn',
        businessName: 'CLB Cầu Lông Phúc Thịnh',
        phone: '0901234567',
        status: 'ACTIVE',
      },
      {
        email: 'bach.hoang@badmintonpro.vn',
        businessName: 'Sân Cầu Lông Tân Bình Pro',
        phone: '0912345678',
        status: 'ACTIVE',
      },
      {
        email: 'khanh.le@hoangthanhcourt.vn',
        businessName: 'CLB Cầu Lông Hoàng Thành Q.10',
        phone: '0987654321',
        status: 'ACTIVE',
      },
    ];

    for (const owner of courtOwners) {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, owner.email))
        .limit(1);

      if (existing.length === 0) {
        const [insertedUser] = await db
          .insert(users)
          .values({
            email: owner.email,
            passwordHash: hashedPassword,
            role: 'COURT_OWNER',
            status: owner.status,
          })
          .returning();

        await db.insert(courtOwnerProfiles).values({
          userId: insertedUser.id,
          businessName: owner.businessName,
          phone: owner.phone,
        });
        console.log(`  + Inserted Court Owner: ${owner.email} - ${owner.businessName}`);
      } else {
        console.log(`  ℹ Court Owner ${owner.email} already exists.`);
      }
    }

    // 4. Seed Players (VĐV)
    console.log('🏸 Seeding Player accounts...');
    const intermediateId = skillMap.get('INTERMEDIATE') || 2;
    const beginnerId = skillMap.get('BEGINNER') || 1;
    const advancedId = skillMap.get('ADVANCED') || 3;
    const proId = skillMap.get('PRO') || 4;

    const players = [
      {
        email: 'nam.nguyen@example.com',
        fullName: 'Nguyễn Văn Nam',
        skillLevelId: intermediateId,
        avatarUrl: '/images/avatar_player1-56586a.png',
        status: 'ACTIVE',
        deletedAt: null,
      },
      {
        email: 'nam.le99@example.com',
        fullName: 'Lê Nhật Nam',
        skillLevelId: intermediateId,
        avatarUrl: '/images/avatar_player2-4a0be7.png',
        status: 'SUSPENDED',
        deletedAt: null,
      },
      {
        email: 'tuan.do@example.com',
        fullName: 'Đỗ Anh Tuấn',
        skillLevelId: advancedId,
        avatarUrl: '/images/avatar_player3-7ca715.png',
        status: 'ACTIVE',
        deletedAt: null,
      },
      {
        email: 'khiem.pham@example.com',
        fullName: 'Phạm Gia Khiêm',
        skillLevelId: beginnerId,
        avatarUrl: null,
        status: 'DEACTIVATED',
        deletedAt: new Date('2024-02-20T00:00:00.000Z'),
      },
      {
        email: 'huong.mai@example.com',
        fullName: 'Mai Lan Hương',
        skillLevelId: beginnerId,
        avatarUrl: '/images/avatar_player1-56586a.png',
        status: 'ACTIVE',
        deletedAt: null,
      },
      {
        email: 'duc.tran@example.com',
        fullName: 'Trần Minh Đức',
        skillLevelId: proId,
        avatarUrl: '/images/avatar_player2-4a0be7.png',
        status: 'ACTIVE',
        deletedAt: null,
      },
    ];

    for (const player of players) {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, player.email))
        .limit(1);

      if (existing.length === 0) {
        const [insertedUser] = await db
          .insert(users)
          .values({
            email: player.email,
            passwordHash: hashedPassword,
            role: 'PLAYER',
            status: player.status,
            deletedAt: player.deletedAt,
          })
          .returning();

        await db.insert(playerProfiles).values({
          userId: insertedUser.id,
          fullName: player.fullName,
          skillLevelId: player.skillLevelId,
          avatarUrl: player.avatarUrl,
        });
        console.log(`  + Inserted Player: ${player.email} (${player.fullName}) [${player.status}]`);
      } else {
        console.log(`  ℹ Player ${player.email} already exists.`);
      }
    }

    console.log('✅ Database seeding completed successfully!');
    console.log('🔑 Default password for all seeded accounts is: Password@123');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
