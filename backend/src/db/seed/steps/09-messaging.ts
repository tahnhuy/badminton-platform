import { sql } from 'drizzle-orm';
import { db } from '../../index';
import { messagingService } from '../../../services/messaging/MessagingService';
import { CONVERSATIONS } from '../data/messages';
import { MAIN_PLAYER_KEY } from '../data/people';
import { at, stampAt } from '../lib/stamp';
import { uuidFor } from '../lib/ids';
import type { SeedContext } from '../context';

/** Direct and group chats through the real Messaging service, with replies, reactions and unread lines. */
export async function seedMessaging(ctx: SeedContext): Promise<void> {
  const latest = ctx.clock.now.getTime() - 2 * 60_000;
  const main = ctx.players.get(MAIN_PLAYER_KEY)!;
  let messages = 0;
  for (const [index, script] of CONVERSATIONS.entries()) {
    const ids = script.members.map(key => ctx.players.get(key));
    if (ids.some(p => !p || !p.active)) throw new Error(`Conversation ${index}: unknown or inactive member`);
    const [creator, ...others] = ids.map(p => p!.id);
    const startedAt = ctx.clock.at(-script.startedDaysAgo, script.startHour);

    const conversationId = await stampAt(startedAt, async () => script.kind === 'DIRECT'
      ? (await messagingService.openOrCreateDirectConversation(creator, others[0])).conversation.id
      : (await messagingService.createGroupConversation(creator, script.title!, others)).id);

    for (const [n, line] of script.lines.entries()) {
      const sentAt = new Date(startedAt.getTime() + line.min * 60_000);
      if (sentAt.getTime() > latest) continue;
      const sender = ctx.players.get(line.from)!.id;
      const sent = await stampAt(sentAt, () => messagingService.sendMessage(sender, conversationId, {
        text: line.text, parentId: null, clientMessageId: uuidFor(`message-${index}-${n}`), images: [], files: [],
      }));
      messages += 1;
      if (line.react) {
        const reactedAt = new Date(Math.min(latest, sentAt.getTime() + 3 * 60_000));
        await messagingService.setMessageReaction(ctx.players.get(line.react.by)!.id, sent.message.id, line.react.type);
        await db.execute(sql`UPDATE message_reactions SET created_at = ${await at('message_reactions', 'created_at', reactedAt)}, updated_at = ${await at('message_reactions', 'updated_at', reactedAt)}
          WHERE message_id = ${sent.message.id}`);
      }
    }

    // Conversation and membership rows are UPDATED by every send: align them with the history.
    await db.execute(sql`
      UPDATE conversations c SET created_at = ${await at('conversations', 'created_at', startedAt)},
        last_message_at = (SELECT MAX(created_at) FROM messages m WHERE m.conversation_id = c.id)
      WHERE c.id = ${conversationId}`);
    await db.execute(sql`
      UPDATE conversation_members cm SET
        joined_at = ${await at('conversation_members', 'joined_at', startedAt)},
        first_sent_at = (SELECT MIN(created_at) FROM messages m WHERE m.conversation_id = cm.conversation_id AND m.sender_id = cm.user_id),
        updated_at = COALESCE((SELECT MAX(created_at) FROM messages m WHERE m.conversation_id = cm.conversation_id), ${await at('conversation_members', 'updated_at', startedAt)}),
        last_read_seq = GREATEST(0, (SELECT last_seq FROM conversations c WHERE c.id = cm.conversation_id)
          - CASE WHEN cm.user_id = ${main.id} THEN ${script.unreadForMain ?? 0} ELSE 0 END)
      WHERE cm.conversation_id = ${conversationId}`);
  }
  const unread = await db.execute(sql`
    SELECT COUNT(*) AS n FROM conversation_members cm JOIN messages m ON m.conversation_id = cm.conversation_id
    WHERE cm.user_id = ${main.id} AND m.seq > cm.last_read_seq AND m.sender_id <> ${main.id}`);
  ctx.log(`Tin nhắn: ${CONVERSATIONS.length} hội thoại, ${messages} tin; tài khoản demo chính có ${(unread.rows[0] as { n: string }).n} tin chưa đọc`);
}
