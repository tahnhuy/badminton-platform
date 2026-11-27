import { eq, sql } from 'drizzle-orm';
import { db } from '../../index';
import { systemConfigs } from '../../schema/config';
import { reportSubmissionService } from '../../../services/reports/ReportSubmissionService';
import { adminReportService } from '../../../services/admin/AdminReportService';
import { adminConfigService } from '../../../services/admin/AdminConfigService';
import { socialPostService } from '../../../services/social/SocialPostService';
import { socialInteractionService } from '../../../services/social/SocialInteractionService';
import { messagingService } from '../../../services/messaging/MessagingService';
import { MAIN_PLAYER_KEY } from '../data/people';
import { uuidFor } from '../lib/ids';
import { at, stampAt } from '../lib/stamp';
import type { SeedContext } from '../context';

/**
 * Moderation work for the Admin: player38 posts a scam, leaves a rude comment and sends an
 * abusive message; other players report them through the real Report service; the Admin
 * resolves some reports and hides the scam post; two config changes leave an audit trail.
 */
export async function seedModeration(ctx: SeedContext): Promise<void> {
  const { clock } = ctx;
  const main = ctx.players.get(MAIN_PLAYER_KEY)!;
  const offender = ctx.players.get('player38')!;
  const victim = ctx.players.get('player12')!;
  const reporters = ['player01', 'player02', 'player05'].map(k => ctx.players.get(k)!);
  const viewer = (id: number) => ({ id, role: 'PLAYER' });
  const admin = { id: ctx.adminId, role: 'ADMIN' };

  // 1. A scam post, reported three times; the Admin resolves one report and hides the post.
  const postedAt = clock.at(-3, '22:40');
  const scam = await stampAt(postedAt, () => socialPostService.create(viewer(offender.id), {
    type: 'FREE', body: 'Thanh lý vợt chính hãng giá chỉ 200k!!! Chuyển khoản trước 100% qua số tài khoản riêng, không giao hàng COD. Nhanh tay kẻo hết!',
    clientRequestId: uuidFor('scam-post'),
  }, []));
  const reportIds: number[] = [];
  for (const [n, reporter] of [...reporters, main].entries()) {
    const reportedAt = new Date(postedAt.getTime() + (n + 1) * 47 * 60_000);
    const created = await stampAt(reportedAt, () => reportSubmissionService.create(viewer(reporter.id), {
      targetType: 'POST', targetId: scam.post.id, reasonCode: n % 2 === 0 ? 'SCAM' : 'SPAM',
      description: n === 0 ? 'Yêu cầu chuyển khoản trước, có dấu hiệu lừa đảo.' : undefined,
    }));
    reportIds.push(Number(created.data.id));
  }
  const reviewedAt = clock.at(-2, '09:15');
  await stampAt(reviewedAt, async () => {
    await adminReportService.updateStatus(admin, reportIds[0], 'RESOLVED');
    await socialInteractionService.hidePost(ctx.adminId, scam.post.id);
  });
  await db.execute(sql`UPDATE reports SET resolved_at = ${await at('reports', 'resolved_at', reviewedAt)}, updated_at = ${await at('reports', 'updated_at', reviewedAt)} WHERE id = ${reportIds[0]}`);
  await db.execute(sql`UPDATE posts SET hidden_at = ${await at('posts', 'hidden_at', reviewedAt)} WHERE id = ${scam.post.id}`);

  // 2. A rude comment under one of the main account's posts, reported by the main account (open).
  const [mainPost] = (await db.execute(sql`SELECT id FROM posts WHERE author_id = ${main.id} AND type = 'FREE' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`)).rows as Array<{ id: string }>;
  if (mainPost) {
    const commentedAt = clock.at(-1, '23:05');
    const comment = await stampAt(commentedAt, () => socialInteractionService.createComment(viewer(offender.id), Number(mainPost.id),
      'Chơi dở mà cũng bày đặt chia sẻ, đừng đăng nữa cho đỡ chướng mắt.', uuidFor('rude-comment')));
    await stampAt(clock.minutesFromNow(-8 * 60), () => reportSubmissionService.create(viewer(main.id), {
      targetType: 'COMMENT', targetId: comment.comment.id, reasonCode: 'HARASSMENT', description: 'Bình luận xúc phạm người khác.',
    }));
  }

  // 3. An abusive direct message, reported by the recipient (open).
  const chatAt = clock.at(-1, '21:00');
  const conversation = await stampAt(chatAt, () => messagingService.openOrCreateDirectConversation(offender.id, victim.id));
  const message = await stampAt(chatAt, () => messagingService.sendMessage(offender.id, conversation.conversation.id, {
    text: 'Lần sau gặp ngoài sân thì liệu hồn đấy.', parentId: null, clientMessageId: uuidFor('abusive-message'), images: [], files: [],
  }));
  await db.execute(sql`UPDATE conversations c SET created_at = ${await at('conversations', 'created_at', chatAt)},
    last_message_at = ${await at('conversations', 'last_message_at', chatAt)} WHERE c.id = ${conversation.conversation.id}`);
  await db.execute(sql`UPDATE conversation_members SET joined_at = ${await at('conversation_members', 'joined_at', chatAt)}, updated_at = ${await at('conversation_members', 'updated_at', chatAt)},
    first_sent_at = CASE WHEN user_id = ${offender.id} THEN ${await at('conversation_members', 'first_sent_at', chatAt)} ELSE NULL END,
    last_read_seq = (SELECT last_seq FROM conversations WHERE id = ${conversation.conversation.id})
    WHERE conversation_id = ${conversation.conversation.id}`);
  await stampAt(clock.at(-1, '21:20'), () => reportSubmissionService.create(viewer(victim.id), {
    targetType: 'MESSAGE', targetId: message.message.id, reasonCode: 'HARASSMENT', description: 'Tin nhắn đe doạ.',
  }));

  // report_evidence is keyed by report (no id): date the captured content with its report.
  await db.execute(sql`UPDATE report_evidence e SET captured_at = r.created_at FROM reports r WHERE r.id = e.report_id`);

  // 4. Admin config changes with audit history (values the demo is not sensitive to).
  const changes: Array<[string, number, Date]> = [['SOCIAL_FREE_POSTS_PER_DAY', 15, clock.at(-10, '10:00')], ['MESSAGING_MESSAGES_PER_MINUTE', 40, clock.at(-6, '14:30')]];
  for (const [key, value, when] of changes) {
    await stampAt(when, () => adminConfigService.updateConfig(key, value, ctx.adminId));
    await db.update(systemConfigs).set({ updatedAt: when }).where(eq(systemConfigs.configKey, key));
  }

  const open = await db.execute(sql`SELECT COUNT(*) FILTER (WHERE status = 'OPEN') AS open, COUNT(*) AS total FROM reports`);
  const row = open.rows[0] as { open: string; total: string };
  ctx.log(`Kiểm duyệt: ${row.total} báo cáo (${row.open} đang chờ), 1 bài bị Admin ẩn, ${changes.length} lần đổi cấu hình có lịch sử`);
}
