import type { IncomingMessage } from 'http';
import type { Server as HttpServer } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db, users, authSessions, conversations, conversationMembers } from '../../db';
import { parseCookies } from '../../utils/session-cookie';
import {
  authRepository,
  hashSessionToken,
  setSessionRevokeCallbacks,
} from '../../repositories/auth/AuthRepository';
import { messagingConfig } from '../../shared/config/messaging-config';
import { messagingRepository } from '../../repositories/messaging/MessagingRepository';
import { env } from '../../shared/config/env';

export type MessagingWsEventType =
  | 'message.created'
  | 'message.updated'
  | 'message.recalled'
  | 'message.reaction_updated'
  | 'conversation.read_updated'
  | 'conversation.member_changed'
  | 'conversation.updated'
  | 'conversation.dissolved'
  | 'presence.updated'
  | 'typing.updated';

export interface MessagingWsEnvelope<T = unknown> {
  type: MessagingWsEventType;
  data: T;
  timestamp: string;
}

interface TrackedConnection {
  ws: WebSocket;
  userId: number;
  sessionId: number;
  tokenHash: string | null;
}

const WS_PATH = '/api/v1/ws/messaging';
const HEARTBEAT_INTERVAL_MS = 30_000;
const WS_POLICY_VIOLATION = 1008;

export class MessagingWsHub {
  private wss: WebSocketServer = new WebSocketServer({ noServer: true });
  private attachedServers = new WeakSet<HttpServer>();
  private connections = new Set<TrackedConnection>();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    setSessionRevokeCallbacks({
      onRawTokenRevoked: (rawToken) => this.closeByRawToken(rawToken, 'Session revoked'),
      onUserSessionsRevoked: (userId) => this.closeByUserId(userId, 'All sessions revoked'),
    });
  }

  attach(server: HttpServer): void {
    if (this.attachedServers.has(server)) {
      return;
    }
    this.attachedServers.add(server);
    const wss = this.wss;

    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const urlPath = (req.url || '').split('?')[0];
      if (urlPath !== WS_PATH) {
        return;
      }

      this.handleUpgrade(wss, req, socket, head).catch(() => {
        this.rejectUpgrade(socket, 500, 'Internal Server Error');
      });
    });

    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        this.runHeartbeatCheck().catch(() => {});
      }, HEARTBEAT_INTERVAL_MS);
      if (this.heartbeatTimer.unref) {
        this.heartbeatTimer.unref();
      }
    }
  }

  private rejectUpgrade(socket: Duplex, statusCode: number, statusText: string): void {
    try {
      socket.write(
        `HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`
      );
    } catch {
      // ignore write errors
    } finally {
      socket.destroy();
    }
  }

  private async authenticateUpgrade(
    req: IncomingMessage
  ): Promise<
    | { ok: true; userId: number; sessionId: number; tokenHash: string | null }
    | { ok: false; statusCode: number; statusText: string }
  > {
    const cfg = await messagingConfig.get();
    if (!cfg.enabled) {
      return { ok: false, statusCode: 409, statusText: 'Messaging Disabled' };
    }

    const cookies = parseCookies(req.headers.cookie);
    const sid = cookies.sid;

    if (sid) {
      const active = await authRepository.findActiveSessionWithUser(sid);
      if (!active) {
        return { ok: false, statusCode: 401, statusText: 'Unauthorized' };
      }

      const { session, user } = active;
      const now = new Date();
      const idleDeadline = new Date(
        session.lastSeenAt.getTime() + session.idleTimeoutMinutes * 60 * 1000
      );

      if (
        session.expiresAt <= now ||
        idleDeadline <= now ||
        user.deletedAt !== null ||
        user.status !== 'ACTIVE'
      ) {
        return { ok: false, statusCode: 401, statusText: 'Unauthorized' };
      }

      if (user.role !== 'PLAYER' || user.mustChangePassword) {
        return { ok: false, statusCode: 403, statusText: 'Forbidden' };
      }

      return {
        ok: true,
        userId: user.id,
        sessionId: session.id,
        tokenHash: hashSessionToken(sid),
      };
    }

    // Test-only header fallback when ALLOW_TEST_AUTH=true and no sid cookie was sent
    const isTestAuthAllowed = env.NODE_ENV !== 'production' && process.env.ALLOW_TEST_AUTH === 'true';
    const userIdHeader = req.headers['x-user-id'];
    if (isTestAuthAllowed && typeof userIdHeader === 'string') {
      const parsedId = Number(userIdHeader);
      if (Number.isInteger(parsedId) && parsedId > 0) {
        const [user] = await db
          .select()
          .from(users)
          .where(and(eq(users.id, parsedId), isNull(users.deletedAt)))
          .limit(1);

        if (!user || user.status !== 'ACTIVE') {
          return { ok: false, statusCode: 401, statusText: 'Unauthorized' };
        }
        if (user.role !== 'PLAYER' || user.mustChangePassword) {
          return { ok: false, statusCode: 403, statusText: 'Forbidden' };
        }
        return {
          ok: true,
          userId: user.id,
          sessionId: 0,
          tokenHash: null,
        };
      }
    }

    return { ok: false, statusCode: 401, statusText: 'Unauthorized' };
  }

  private async handleUpgrade(
    wss: WebSocketServer,
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer
  ): Promise<void> {
    const authResult = await this.authenticateUpgrade(req);
    if (!authResult.ok) {
      this.rejectUpgrade(socket, authResult.statusCode, authResult.statusText);
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const conn: TrackedConnection = {
        ws,
        userId: authResult.userId,
        sessionId: authResult.sessionId,
        tokenHash: authResult.tokenHash,
      };
      this.connections.add(conn);

      ws.on('message', async () => {
        const valid = await this.validateConnection(conn);
        if (!valid) {
          return;
        }
      });

      ws.on('close', () => {
        this.connections.delete(conn);
      });

      ws.on('error', () => {
        this.connections.delete(conn);
      });
    });
  }

  /**
   * Re-verifies session expiry (idle_expires_at / absolute_expires_at), revocation,
   * messaging feature gate, and user ACTIVE status. Immediately closes with 1008 if invalid.
   */
  async validateConnection(conn: TrackedConnection): Promise<boolean> {
    if (conn.ws.readyState !== WebSocket.OPEN) {
      this.connections.delete(conn);
      return false;
    }

    try {
      const cfg = await messagingConfig.get();
      if (!cfg.enabled) {
        this.closeConnection(conn, 'Messaging disabled');
        return false;
      }

      const now = new Date();

      if (conn.sessionId > 0) {
        const [row] = await db
          .select({
            session: authSessions,
            user: {
              id: users.id,
              role: users.role,
              status: users.status,
              deletedAt: users.deletedAt,
              mustChangePassword: users.mustChangePassword,
            },
          })
          .from(authSessions)
          .innerJoin(users, eq(users.id, authSessions.userId))
          .where(eq(authSessions.id, conn.sessionId))
          .limit(1);

        if (!row) {
          this.closeConnection(conn, 'Session not found');
          return false;
        }

        const { session, user } = row;
        const idleDeadline = new Date(
          session.lastSeenAt.getTime() + session.idleTimeoutMinutes * 60 * 1000
        );

        if (
          session.revokedAt !== null ||
          session.expiresAt <= now ||
          idleDeadline <= now ||
          user.deletedAt !== null ||
          user.status !== 'ACTIVE' ||
          user.role !== 'PLAYER' ||
          user.mustChangePassword
        ) {
          this.closeConnection(conn, 'Session expired or revoked');
          return false;
        }

        return true;
      }

      // Test-auth connection (sessionId === 0): check user status
      const [user] = await db
        .select({
          id: users.id,
          role: users.role,
          status: users.status,
          deletedAt: users.deletedAt,
          mustChangePassword: users.mustChangePassword,
        })
        .from(users)
        .where(eq(users.id, conn.userId))
        .limit(1);

      if (
        !user ||
        user.deletedAt !== null ||
        user.status !== 'ACTIVE' ||
        user.role !== 'PLAYER' ||
        user.mustChangePassword
      ) {
        this.closeConnection(conn, 'Account not active');
        return false;
      }

      return true;
    } catch {
      this.closeConnection(conn, 'Validation failed');
      return false;
    }
  }

  private closeConnection(conn: TrackedConnection, reason: string): void {
    this.connections.delete(conn);
    try {
      if (conn.ws.readyState === WebSocket.OPEN || conn.ws.readyState === WebSocket.CONNECTING) {
        conn.ws.close(WS_POLICY_VIOLATION, reason);
      }
    } catch {
      // ignore close errors
    }
  }

  closeBySessionId(sessionId: number, reason = 'Session revoked'): void {
    for (const conn of Array.from(this.connections)) {
      if (conn.sessionId === sessionId) {
        this.closeConnection(conn, reason);
      }
    }
  }

  closeByRawToken(rawToken: string, reason = 'Session revoked'): void {
    const tokenHash = hashSessionToken(rawToken);
    for (const conn of Array.from(this.connections)) {
      if (conn.tokenHash === tokenHash) {
        this.closeConnection(conn, reason);
      }
    }
  }

  closeByUserId(userId: number, reason = 'Account or session revoked'): void {
    for (const conn of Array.from(this.connections)) {
      if (conn.userId === userId) {
        this.closeConnection(conn, reason);
      }
    }
  }

  async runHeartbeatCheck(): Promise<void> {
    const current = Array.from(this.connections);
    for (const conn of current) {
      const valid = await this.validateConnection(conn);
      if (valid && conn.ws.readyState === WebSocket.OPEN) {
        try {
          conn.ws.ping();
        } catch {
          this.connections.delete(conn);
        }
      }
    }
  }

  async notifyUsers<T>(
    targetUserIds: number[],
    eventType: MessagingWsEventType,
    data: T
  ): Promise<void> {
    await this.pushToUserIds(targetUserIds, eventType, data);
  }

  private async pushToUserIds<T>(
    targetUserIds: number[],
    eventType: MessagingWsEventType,
    data: T,
    conversationId?: number
  ): Promise<void> {
    if (targetUserIds.length === 0 || this.connections.size === 0) {
      return;
    }

    const targetSet = new Set(targetUserIds);
    const matching = Array.from(this.connections).filter((c) => targetSet.has(c.userId));
    if (matching.length === 0) {
      return;
    }

    const payload = JSON.stringify({
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
    } satisfies MessagingWsEnvelope<T>);

    for (const conn of matching) {
      const valid = await this.validateConnection(conn);
      if (valid && conn.ws.readyState === WebSocket.OPEN) {
        // Fanout can wait on connection validation while a membership is revoked.
        // Re-read immediately before send instead of trusting the recipient snapshot.
        if (conversationId !== undefined) {
          const [member] = await db.select({ userId: conversationMembers.userId }).from(conversationMembers)
            .where(and(eq(conversationMembers.conversationId, conversationId),
              eq(conversationMembers.userId, conn.userId), eq(conversationMembers.state, 'ACTIVE'))).limit(1);
          if (!member) continue;
        }
        try {
          conn.ws.send(payload);
        } catch {
          this.connections.delete(conn);
        }
      }
    }
  }

  /**
   * Broadcasts a conversation event after transaction commit.
   * - Never delivers to LEFT members.
   * - For DIRECT conversations, filters out blocked counterparts.
   * - For GROUP conversations, delivers to all ACTIVE group members (matching REST §7.2).
   */
  async broadcastConversationEvent<T>(
    conversationId: number,
    eventType: MessagingWsEventType,
    data: T,
    actorUserId?: number
  ): Promise<void> {
    if (this.connections.size === 0) {
      return;
    }

    const [conv] = await db
      .select({ id: conversations.id, type: conversations.type })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conv) {
      return;
    }

    const activeMembers = await db
      .select({
        userId: conversationMembers.userId,
      })
      .from(conversationMembers)
      .innerJoin(users, eq(users.id, conversationMembers.userId))
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.state, 'ACTIVE'),
          eq(users.role, 'PLAYER'),
          eq(users.status, 'ACTIVE'),
          isNull(users.deletedAt)
        )
      );

    let recipientIds = activeMembers.map((m) => m.userId);

    if (conv.type === 'DIRECT' && actorUserId !== undefined) {
      const filtered: number[] = [];
      for (const memberId of recipientIds) {
        if (memberId === actorUserId) {
          filtered.push(memberId);
          continue;
        }
        const blocked = await messagingRepository.isBlockedEitherWay(actorUserId, memberId);
        if (!blocked) {
          filtered.push(memberId);
        }
      }
      recipientIds = filtered;
    }

    await this.pushToUserIds(recipientIds, eventType, data, conversationId);
  }

  /**
   * Broadcasts presence.updated to all ACTIVE co-members across shared conversations
   * who do NOT have a direct block relationship with actorUserId.
   */
  async broadcastPresenceUpdate(
    actorUserId: number,
    lastSeenAt: Date,
    isOnline: boolean
  ): Promise<void> {
    if (this.connections.size === 0) {
      return;
    }

    const myActiveConvs = await db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
      .where(
        and(
          eq(conversationMembers.userId, actorUserId),
          eq(conversationMembers.state, 'ACTIVE'),
          eq(conversations.status, 'ACTIVE')
        )
      );

    if (myActiveConvs.length === 0) {
      return;
    }

    const convIds = myActiveConvs.map((c) => c.conversationId);
    const coMembers = await db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .innerJoin(users, eq(users.id, conversationMembers.userId))
      .where(
        and(
          inArray(conversationMembers.conversationId, convIds),
          eq(conversationMembers.state, 'ACTIVE'),
          eq(users.role, 'PLAYER'),
          eq(users.status, 'ACTIVE'),
          isNull(users.deletedAt)
        )
      );

    const uniqueCandidateIds = Array.from(
      new Set(coMembers.map((m) => m.userId).filter((id) => id !== actorUserId))
    );

    const allowedRecipientIds: number[] = [];
    for (const candidateId of uniqueCandidateIds) {
      const blocked = await messagingRepository.isBlockedEitherWay(actorUserId, candidateId);
      if (!blocked) {
        allowedRecipientIds.push(candidateId);
      }
    }

    await this.pushToUserIds(allowedRecipientIds, 'presence.updated', {
      userId: actorUserId,
      lastSeenAt: lastSeenAt.toISOString(),
      isOnline,
    });
  }
}

export const messagingWsHub = new MessagingWsHub();
