import { randomUUID } from 'crypto';
import zlib from 'zlib';
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import app from '../app';
import {
  db,
  users,
  playerProfiles,
  skillLevels,
  systemConfigs,
  mediaFiles,
} from '../db';
import { messagingConfig } from '../shared/config/messaging-config';
import { privateMediaStorage } from '../shared/storage/private-media-storage';

const CSRF = 'test-csrf-token';

function asUser(userId: number) {
  return {
    'x-user-id': String(userId),
    Cookie: `csrf_token=${CSRF}`,
    'X-CSRF-Token': CSRF,
  };
}

/**
 * Minimal uncompressed ZIP builder (compression method 0 = STORE) for testing yauzl@3.4.0 central directory checks.
 */
function buildZipBuffer(
  entries: Array<{
    name: string;
    data: Buffer;
    generalPurposeBitFlag?: number;
    declaredUncompressedSize?: number;
  }>
): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf-8');
    const dataBuf = entry.data;
    const crc = zlib.crc32(dataBuf) >>> 0;
    const flag = entry.generalPurposeBitFlag ?? 0;
    const uncompressedSize = entry.declaredUncompressedSize ?? dataBuf.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(flag, 6); // general purpose bit flag
    localHeader.writeUInt16LE(0, 8); // compression method: STORE
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuf.length, 18); // compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra len

    localParts.push(localHeader, nameBuf, dataBuf);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // central file header signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(flag, 8); // general purpose bit flag
    centralHeader.writeUInt16LE(0, 10); // compression method: STORE
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuf.length, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra len
    centralHeader.writeUInt16LE(0, 32); // comment len
    centralHeader.writeUInt16LE(0, 34); // disk number
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // relative offset of local header

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + dataBuf.length;
  }

  const centralDirBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirBuf, eocd]);
}

function createValidDocxBuffer(): Buffer {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const docXml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>`;
  return buildZipBuffer([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf-8') },
    { name: 'word/document.xml', data: Buffer.from(docXml, 'utf-8') },
  ]);
}

function createValidXlsxBuffer(): Buffer {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
</Types>`;
  const workbookXml = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"></workbook>`;
  return buildZipBuffer([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf-8') },
    { name: 'xl/workbook.xml', data: Buffer.from(workbookXml, 'utf-8') },
  ]);
}

describe('Messaging send, private media, file validation, history, sync, read & reactions (MSG-04, MSG-05, MSG-06)', () => {
  let p1Id: number;
  let p2Id: number;
  let p3Id: number;
  let validPngBuffer: Buffer;

  beforeEach(async () => {
    process.env.ALLOW_TEST_AUTH = 'true';
    await db
      .insert(systemConfigs)
      .values([
        { configKey: 'MESSAGING_ENABLED', configValue: 'true' },
        { configKey: 'MESSAGING_GROUP_MAX_MEMBERS', configValue: '20' },
        { configKey: 'MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY', configValue: '20' },
        { configKey: 'MESSAGING_MESSAGES_PER_MINUTE', configValue: '30' },
      ])
      .onConflictDoUpdate({
        target: systemConfigs.configKey,
        set: { configValue: 'true' },
      });
    await db
      .insert(systemConfigs)
      .values({ configKey: 'MESSAGING_MESSAGES_PER_MINUTE', configValue: '30' })
      .onConflictDoUpdate({
        target: systemConfigs.configKey,
        set: { configValue: '30' },
      });
    await db
      .insert(systemConfigs)
      .values({ configKey: 'MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY', configValue: '20' })
      .onConflictDoUpdate({
        target: systemConfigs.configKey,
        set: { configValue: '20' },
      });
    messagingConfig.clearCache();

    const [skill] = await db.select().from(skillLevels).limit(1);
    const inserted = await db
      .insert(users)
      .values([
        { email: 'm1@msg.test', passwordHash: 'h', role: 'PLAYER', status: 'ACTIVE' },
        { email: 'm2@msg.test', passwordHash: 'h', role: 'PLAYER', status: 'ACTIVE' },
        { email: 'm3@msg.test', passwordHash: 'h', role: 'PLAYER', status: 'ACTIVE' },
      ])
      .returning();

    p1Id = inserted[0].id;
    p2Id = inserted[1].id;
    p3Id = inserted[2].id;

    await db.insert(playerProfiles).values([
      { userId: p1Id, fullName: 'Sender 1', skillLevelId: skill.id },
      { userId: p2Id, fullName: 'Sender 2', skillLevelId: skill.id },
      { userId: p3Id, fullName: 'Sender 3', skillLevelId: skill.id },
    ]);

    validPngBuffer = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: { r: 20, g: 120, b: 220 },
      },
    })
      .png()
      .toBuffer();
  });

  it('produces gapless seq 1..20 under 20 concurrent sends and handles clientMessageId replay & conflict (MSG-04)', async () => {
    const groupRes = await request(app)
      .post('/api/v1/conversations/group')
      .set(asUser(p1Id))
      .send({ title: 'Concurrent Seq Group', memberIds: [p2Id, p3Id] });
    const groupId = groupRes.body.data.id;

    // 20 parallel sends across p1, p2, p3
    const senders = [p1Id, p2Id, p3Id];
    const parallelPromises = Array.from({ length: 20 }, (_, idx) => {
      const sender = senders[idx % senders.length];
      return request(app)
        .post(`/api/v1/conversations/${groupId}/messages`)
        .set(asUser(sender))
        .send({
          text: `Concurrent message #${idx + 1}`,
          clientMessageId: randomUUID(),
        });
    });

    const responses = await Promise.all(parallelPromises);
    for (const r of responses) {
      expect(r.status).toBe(201);
    }

    const seqs = responses.map((r) => r.body.data.seq as number).sort((a, b) => a - b);
    expect(seqs).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));

    // Replay same clientMessageId + same content -> 200 OK, same seq, no duplicate message
    const idempId = randomUUID();
    const firstSend = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(p1Id))
      .send({ text: 'Idempotent hello', clientMessageId: idempId });
    expect(firstSend.status).toBe(201);
    expect(firstSend.body.data.seq).toBe(21);

    const replaySend = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(p1Id))
      .send({ text: 'Idempotent hello', clientMessageId: idempId });
    expect(replaySend.status).toBe(200);
    expect(replaySend.body.data.id).toBe(firstSend.body.data.id);
    expect(replaySend.body.data.seq).toBe(21);

    // Same clientMessageId with different text -> 409 MESSAGING_CLIENT_ID_CONFLICT
    const conflictSend = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(p1Id))
      .send({ text: 'Changed text with same UUID', clientMessageId: idempId });
    expect(conflictSend.status).toBe(409);
    expect(conflictSend.body.error.code).toBe('MESSAGING_CLIENT_ID_CONFLICT');

    // LEFT group member sending -> 404 MESSAGING_CONVERSATION_NOT_FOUND
    await request(app).post(`/api/v1/conversations/${groupId}/leave`).set(asUser(p3Id));
    const leftSend = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(p3Id))
      .send({ text: 'Should fail after leave', clientMessageId: randomUUID() });
    expect(leftSend.status).toBe(404);
    expect(leftSend.body.error.code).toBe('MESSAGING_CONVERSATION_NOT_FOUND');
  });

  it('enforces per-minute message quota and new-direct-per-day quota while allowing replies in existing conversations (MSG-04)', async () => {
    // Set MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY = 1 and MESSAGING_MESSAGES_PER_MINUTE = 3 for fast deterministic test
    await db
      .insert(systemConfigs)
      .values({ configKey: 'MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY', configValue: '1' })
      .onConflictDoUpdate({
        target: systemConfigs.configKey,
        set: { configValue: '1' },
      });
    await db
      .insert(systemConfigs)
      .values({ configKey: 'MESSAGING_MESSAGES_PER_MINUTE', configValue: '3' })
      .onConflictDoUpdate({
        target: systemConfigs.configKey,
        set: { configValue: '3' },
      });
    messagingConfig.clearCache();

    // p1 opens direct conversation #1 with p2 and sends 1st message -> allowed
    const d1 = await request(app)
      .post('/api/v1/conversations/direct')
      .set(asUser(p1Id))
      .send({ playerId: p2Id });
    const conv1Id = d1.body.data.id;

    const m1 = await request(app)
      .post(`/api/v1/conversations/${conv1Id}/messages`)
      .set(asUser(p1Id))
      .send({ text: 'First new direct today', clientMessageId: randomUUID() });
    expect(m1.status).toBe(201);

    // p1 opens direct conversation #2 with p3 and tries to send -> 429 MESSAGING_RATE_LIMITED (daily new-direct limit = 1)
    const d2 = await request(app)
      .post('/api/v1/conversations/direct')
      .set(asUser(p1Id))
      .send({ playerId: p3Id });
    const conv2Id = d2.body.data.id;

    const mNewBlocked = await request(app)
      .post(`/api/v1/conversations/${conv2Id}/messages`)
      .set(asUser(p1Id))
      .send({ text: 'Second new direct today should hit 429', clientMessageId: randomUUID() });
    expect(mNewBlocked.status).toBe(429);
    expect(mNewBlocked.body.error.code).toBe('MESSAGING_RATE_LIMITED');
    expect(mNewBlocked.headers['retry-after']).toBeDefined();

    // Replying in existing conversation #1 is STILL allowed!
    const m2 = await request(app)
      .post(`/api/v1/conversations/${conv1Id}/messages`)
      .set(asUser(p1Id))
      .send({ text: 'Reply in existing conversation #1', clientMessageId: randomUUID() });
    expect(m2.status).toBe(201);

    // 3rd message in 60s -> allowed; 4th message in 60s -> 429 MESSAGING_RATE_LIMITED (per-minute limit = 3)
    const m3 = await request(app)
      .post(`/api/v1/conversations/${conv1Id}/messages`)
      .set(asUser(p1Id))
      .send({ text: 'Third message in minute', clientMessageId: randomUUID() });
    expect(m3.status).toBe(201);

    const m4 = await request(app)
      .post(`/api/v1/conversations/${conv1Id}/messages`)
      .set(asUser(p1Id))
      .send({ text: 'Fourth message in minute exceeds limit 3', clientMessageId: randomUUID() });
    expect(m4.status).toBe(429);
    expect(m4.body.error.code).toBe('MESSAGING_RATE_LIMITED');
  });

  it('validates image and DOCX/XLSX/PDF/TXT file attachments, serves authorized downloads, and rejects invalid/malicious files (MSG-04, MSG-05)', async () => {
    const groupRes = await request(app)
      .post('/api/v1/conversations/group')
      .set(asUser(p1Id))
      .send({ title: 'Attachments Group', memberIds: [p2Id, p3Id] });
    const groupId = groupRes.body.data.id;

    // 1. Send message with 2 valid PNG images
    const imgSend = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(p1Id))
      .field('payload', JSON.stringify({ text: 'Photos from court', clientMessageId: randomUUID() }))
      .attach('images', validPngBuffer, { filename: 'court1.png', contentType: 'image/png' })
      .attach('images', validPngBuffer, { filename: 'court2.png', contentType: 'image/png' });
    expect(imgSend.status).toBe(201);
    expect(imgSend.body.data.attachments).toHaveLength(2);
    const imgMediaId = imgSend.body.data.attachments[0].mediaId;

    // Download image as active member p2 -> 200 inline + nosniff
    const imgDl = await request(app).get(`/api/v1/media/${imgMediaId}`).set(asUser(p2Id));
    expect(imgDl.status).toBe(200);
    expect(imgDl.headers['content-disposition']).toBe('inline');
    expect(imgDl.headers['x-content-type-options']).toBe('nosniff');

    // 2. Send valid DOCX, XLSX, PDF, and TXT files
    const docxSend = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(p1Id))
      .field('payload', JSON.stringify({ clientMessageId: randomUUID() }))
      .attach('file', createValidDocxBuffer(), {
        filename: 'tournament-rules.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    expect(docxSend.status).toBe(201);
    const docxMediaId = docxSend.body.data.attachments[0].mediaId;

    // Download file -> Content-Disposition: attachment + nosniff
    const docxDl = await request(app).get(`/api/v1/media/${docxMediaId}`).set(asUser(p2Id));
    expect(docxDl.status).toBe(200);
    expect(docxDl.headers['content-disposition']).toContain('attachment; filename="tournament-rules.docx"');
    expect(docxDl.headers['x-content-type-options']).toBe('nosniff');

    const xlsxSend = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(p1Id))
      .field('payload', JSON.stringify({ clientMessageId: randomUUID() }))
      .attach('file', createValidXlsxBuffer(), {
        filename: 'schedule.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    expect(xlsxSend.status).toBe(201);

    const pdfSend = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(p1Id))
      .field('payload', JSON.stringify({ clientMessageId: randomUUID() }))
      .attach('file', Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n', 'ascii'), {
        filename: 'bracket.pdf',
        contentType: 'application/pdf',
      });
    expect(pdfSend.status).toBe(201);

    const txtSend = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(p1Id))
      .field('payload', JSON.stringify({ clientMessageId: randomUUID() }))
      .attach('file', Buffer.from('Danh sách sân cầu lông Quận 10', 'utf-8'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });
    expect(txtSend.status).toBe(201);

    // 3. Reject malformed ZIP renamed .docx -> 400 MESSAGING_FILE_INVALID
    const badZipRes = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(p1Id))
      .field('payload', JSON.stringify({ clientMessageId: randomUUID() }))
      .attach('file', Buffer.from('PK\x03\x04corrupted-zip-bytes'), {
        filename: 'broken.docx',
      });
    expect(badZipRes.status).toBe(400);
    expect(badZipRes.body.error.code).toBe('MESSAGING_FILE_INVALID');

    // 4. Reject macro-enabled DOCX containing word/vbaProject.bin -> 400 MESSAGING_FILE_INVALID
    const macroDocx = buildZipBuffer([
      {
        name: '[Content_Types].xml',
        data: Buffer.from(
          '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
        ),
      },
      { name: 'word/document.xml', data: Buffer.from('<w:document/>') },
      { name: 'word/vbaProject.bin', data: Buffer.from('macro') },
    ]);
    const macroRes = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(p1Id))
      .field('payload', JSON.stringify({ clientMessageId: randomUUID() }))
      .attach('file', macroDocx, { filename: 'macro.docx' });
    expect(macroRes.status).toBe(400);
    expect(macroRes.body.error.code).toBe('MESSAGING_FILE_INVALID');

    // 5. Reject encrypted ZIP entry -> 400 MESSAGING_FILE_INVALID
    const encryptedDocx = buildZipBuffer([
      {
        name: '[Content_Types].xml',
        data: Buffer.from(
          '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
        ),
        generalPurposeBitFlag: 0x1,
      },
      { name: 'word/document.xml', data: Buffer.from('<w:document/>') },
    ]);
    const encRes = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(p1Id))
      .field('payload', JSON.stringify({ clientMessageId: randomUUID() }))
      .attach('file', encryptedDocx, { filename: 'encrypted.docx' });
    expect(encRes.status).toBe(400);
    expect(encRes.body.error.code).toBe('MESSAGING_FILE_INVALID');

    // 6. Reject TXT with NUL byte -> 400 MESSAGING_FILE_INVALID
    const nulTxtRes = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(p1Id))
      .field('payload', JSON.stringify({ clientMessageId: randomUUID() }))
      .attach('file', Buffer.from('hello\x00world', 'utf-8'), { filename: 'bad.txt' });
    expect(nulTxtRes.status).toBe(400);
    expect(nulTxtRes.body.error.code).toBe('MESSAGING_FILE_INVALID');

    // 7. Reject mixed image + file -> 400 MESSAGING_ATTACHMENT_MIXED
    const mixedRes = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(p1Id))
      .field('payload', JSON.stringify({ clientMessageId: randomUUID() }))
      .attach('images', validPngBuffer, { filename: 'a.png', contentType: 'image/png' })
      .attach('file', Buffer.from('hello', 'utf-8'), { filename: 'a.txt' });
    expect(mixedRes.status).toBe(400);
    expect(mixedRes.body.error.code).toBe('MESSAGING_ATTACHMENT_MIXED');

    // 8. LEFT member cannot download attachment -> 404; missing disk file marks MISSING and returns 404
    await request(app).post(`/api/v1/conversations/${groupId}/leave`).set(asUser(p3Id));
    const leftDl = await request(app).get(`/api/v1/media/${imgMediaId}`).set(asUser(p3Id));
    expect(leftDl.status).toBe(404);

    const [mediaRow] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, imgMediaId));
    await privateMediaStorage.removeBestEffort(mediaRow.storageKey);
    const missingDl = await request(app).get(`/api/v1/media/${imgMediaId}`).set(asUser(p2Id));
    expect(missingDl.status).toBe(404);
    const [updatedMediaRow] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, imgMediaId));
    expect(updatedMediaRow.state).toBe('MISSING');
  });

  it('implements monotonic clamped read markers, unread counts excluding own/left messages, reactions, and sync snapshots (MSG-06)', async () => {
    const groupRes = await request(app)
      .post('/api/v1/conversations/group')
      .set(asUser(p1Id))
      .send({ title: 'Read & Sync Group', memberIds: [p2Id, p3Id] });
    const groupId = groupRes.body.data.id;

    // Send 8 messages: 5 by p1, 3 by p2
    const sentIds: number[] = [];
    for (let i = 1; i <= 8; i++) {
      const sender = i <= 5 ? p1Id : p2Id;
      const res = await request(app)
        .post(`/api/v1/conversations/${groupId}/messages`)
        .set(asUser(sender))
        .send({ text: `Message seq ${i}`, clientMessageId: randomUUID() });
      expect(res.status).toBe(201);
      sentIds.push(res.body.data.id);
    }

    // p2 has last_read_seq = 8 (from sending message 8), whereas p3 has last_read_seq = 0 -> 8 unread for p3
    const unreadP3Before = await request(app)
      .get('/api/v1/conversations/unread-summary')
      .set(asUser(p3Id));
    expect(unreadP3Before.body.data.totalUnread).toBe(8);

    // p1 sent 1..5 and hasn't read 6..8 (sent by p2) -> p1 has 3 unread (own messages excluded!)
    const unreadP1Before = await request(app)
      .get('/api/v1/conversations/unread-summary')
      .set(asUser(p1Id));
    expect(unreadP1Before.body.data.totalUnread).toBe(3);

    // p1 posts read { seq: 10 } -> clamped to last_seq = 8 (MSG-06 AC)
    const readClamp = await request(app)
      .post(`/api/v1/conversations/${groupId}/read`)
      .set(asUser(p1Id))
      .send({ seq: 10 });
    expect(readClamp.status).toBe(200);
    expect(readClamp.body.data.lastReadSeq).toBe(8);

    // Monotonic check: p1 posts read { seq: 3 } -> stays 8
    const readMono = await request(app)
      .post(`/api/v1/conversations/${groupId}/read`)
      .set(asUser(p1Id))
      .send({ seq: 3 });
    expect(readMono.body.data.lastReadSeq).toBe(8);

    // Reactions & Sync: capture initial sync cursor
    const sync1 = await request(app)
      .get(`/api/v1/conversations/${groupId}/sync?afterSeq=0&sinceVersion=0&minLoadedSeq=1`)
      .set(asUser(p2Id));
    expect(sync1.status).toBe(200);
    expect(sync1.body.data.messages).toHaveLength(8);
    expect(sync1.body.data.nextAfterSeq).toBe(8);
    const v1 = sync1.body.data.nextSinceVersion;

    // p1 and p2 react to message #1
    const r1 = await request(app)
      .put(`/api/v1/messages/${sentIds[0]}/reaction`)
      .set(asUser(p1Id))
      .send({ type: 'LOVE' });
    expect(r1.status).toBe(200);

    const r2 = await request(app)
      .put(`/api/v1/messages/${sentIds[0]}/reaction`)
      .set(asUser(p2Id))
      .send({ type: 'LOVE' });
    expect(r2.status).toBe(200);
    expect(r2.body.data.reactions).toEqual([{ type: 'LOVE', count: 2, reactedByMe: true }]);

    // Sync from afterSeq=8, sinceVersion=v1 returns changedReactions for message #1
    const sync2 = await request(app)
      .get(`/api/v1/conversations/${groupId}/sync?afterSeq=8&sinceVersion=${v1}&minLoadedSeq=1`)
      .set(asUser(p2Id));
    expect(sync2.status).toBe(200);
    expect(sync2.body.data.messages).toHaveLength(0);
    expect(sync2.body.data.changedReactions).toHaveLength(1);
    expect(sync2.body.data.changedReactions[0].messageId).toBe(sentIds[0]);
    expect(sync2.body.data.changedReactions[0].reactions).toEqual([
      { type: 'LOVE', count: 2, reactedByMe: true },
    ]);

    // History cursor pagination: beforeSeq=6, limit=3 -> returns seq 5, 4, 3 and nextBeforeSeq=3
    const hist = await request(app)
      .get(`/api/v1/conversations/${groupId}/messages?beforeSeq=6&limit=3`)
      .set(asUser(p2Id));
    expect(hist.status).toBe(200);
    expect(hist.body.data.map((m: any) => m.seq)).toEqual([5, 4, 3]);
    expect(hist.body.meta).toEqual({ limit: 3, nextBeforeSeq: 3 });
  });
});

