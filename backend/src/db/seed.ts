import * as dotenv from 'dotenv';
dotenv.config();

import { db, pool } from './index';
import { users, skillLevels, playerProfiles, courtOwnerProfiles, facilities, courts, courtPricings, reports } from './schema';
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

    // 5. Seed Facilities & Courts
    console.log('🏟️ Seeding Facilities and Courts...');
    const ownerUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.role, 'COURT_OWNER'));

    if (ownerUsers.length > 0) {
      const defaultFacilities = [
        {
          ownerId: ownerUsers[0].id,
          name: 'CLB Cầu Lông Phúc Thịnh Quận 7',
          description: 'Cụm sân thi đấu cao cấp tiêu chuẩn BWF Grade 2 tại Nam Sài Gòn',
          phone: '0901234567',
          status: 'ACTIVE',
          address: '18D Huỳnh Tấn Phát, P. Tân Thuận Đông, Quận 7',
          ward: 'Tân Thuận Đông',
          district: 'Quận 7',
          city: 'Hồ Chí Minh',
          courtCount: 8,
          openingTime: '05:30:00',
          closingTime: '23:00:00',
        },
        {
          ownerId: ownerUsers[1]?.id || ownerUsers[0].id,
          name: 'CLB Cầu Lông Bình Thạnh Star',
          description: 'Trung tâm huấn luyện & thi đấu cầu lông chuẩn Grade 1 Hub',
          phone: '0912345678',
          status: 'ACTIVE',
          address: '102 Nơ Trang Long, Phường 14, Quận Bình Thạnh',
          ward: 'Phường 14',
          district: 'Bình Thạnh',
          city: 'Hồ Chí Minh',
          courtCount: 16,
          openingTime: '05:00:00',
          closingTime: '23:30:00',
        },
        {
          ownerId: ownerUsers[2]?.id || ownerUsers[0].id,
          name: 'Sân Cầu Lông Cầu Giấy Arena',
          description: 'Cụm sân thảm Yonex đạt chuẩn BWF Grade 2 Hà Nội',
          phone: '0987654321',
          status: 'ACTIVE',
          address: '35 Trần Thái Tông, Dịch Vọng Hậu, Cầu Giấy',
          ward: 'Dịch Vọng Hậu',
          district: 'Cầu Giấy',
          city: 'Hà Nội',
          courtCount: 10,
          openingTime: '06:00:00',
          closingTime: '23:00:00',
        },
      ];

      for (const facData of defaultFacilities) {
        const existingFac = await db
          .select()
          .from(facilities)
          .where(eq(facilities.name, facData.name))
          .limit(1);

        let facId: number;
        if (existingFac.length === 0) {
          const [insertedFac] = await db
            .insert(facilities)
            .values({
              ownerId: facData.ownerId,
              name: facData.name,
              description: facData.description,
              phone: facData.phone,
              status: facData.status,
              address: facData.address,
              ward: facData.ward,
              district: facData.district,
              city: facData.city,
              latitude: '10.7769',
              longitude: '106.7009',
              openingTime: facData.openingTime,
              closingTime: facData.closingTime,
              deletedAt: null,
            })
            .returning();
          facId = insertedFac.id;
          console.log(`  + Inserted Facility: ${facData.name} (#${facId})`);
        } else {
          facId = existingFac[0].id;
          // Ensure active and not deleted
          await db
            .update(facilities)
            .set({ status: 'ACTIVE', deletedAt: null })
            .where(eq(facilities.id, facId));
          console.log(`  ℹ Facility ${facData.name} already exists (#${facId}).`);
        }
      }

      // Ensure all facilities in DB have courts
      const allDbFacs = await db.select().from(facilities);
      for (const fac of allDbFacs) {
        const facCourts = await db.select().from(courts).where(eq(courts.facilityId, fac.id));
        if (facCourts.length === 0) {
          const countToSeed = fac.name.includes('Bình Thạnh') ? 16 : 8;
          for (let i = 1; i <= countToSeed; i++) {
            await db.insert(courts).values({
              facilityId: fac.id,
              name: `Sân ${String(i).padStart(2, '0')}`,
              status: 'ACTIVE',
              deletedAt: null,
            });
          }
          console.log(`    -> Seeded ${countToSeed} courts for ${fac.name} (#${fac.id})`);
        } else {
          await db
            .update(courts)
            .set({ deletedAt: null, status: 'ACTIVE' })
            .where(eq(courts.facilityId, fac.id));
        }
        await db
          .update(facilities)
          .set({ deletedAt: null, status: 'ACTIVE' })
          .where(eq(facilities.id, fac.id));
      }
    }

    // 6. Seed Court Pricings
    console.log('💵 Seeding court pricings...');
    const allCourts = await db.select({ id: courts.id }).from(courts);
    for (const court of allCourts) {
      const existingPricing = await db
        .select()
        .from(courtPricings)
        .where(eq(courtPricings.courtId, court.id))
        .limit(1);

      if (existingPricing.length === 0) {
        await db.insert(courtPricings).values([
          { courtId: court.id, startTime: '06:00:00', endTime: '17:00:00', price: '80000', validFrom: '2026-01-01' },
          { courtId: court.id, startTime: '17:00:00', endTime: '22:00:00', price: '120000', validFrom: '2026-01-01' },
        ]);
      }
    }

    // 7. Seed Sample Reports
    console.log('🚩 Seeding sample reports...');
    const playerUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'PLAYER'));
    const facilityRows = await db.select({ id: facilities.id }).from(facilities);

    if (playerUsers.length >= 2 && facilityRows.length >= 1) {
      const existingReports = await db.select().from(reports).limit(1);
      if (existingReports.length === 0) {
        await db.insert(reports).values([
          {
            reporterId: playerUsers[0].id,
            reportedPlayerId: playerUsers[1].id,
            reasonCode: 'HARASSMENT',
            description: 'Sample report against a player.',
            status: 'OPEN',
          },
          {
            reporterId: playerUsers[1].id,
            reportedFacilityId: facilityRows[0].id,
            reasonCode: 'FACILITY_ISSUE',
            description: 'Sample report against a facility.',
            status: 'OPEN',
          },
        ]);
        console.log('  + Inserted 2 sample reports');
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

