/**
 * Demo conversations. `from` is a player key ('main' = the main demo account); `min` is the
 * minutes after the conversation starts. The last lines of some conversations stay unread
 * for the main account so the inbox shows a badge.
 */
export interface ScriptLine { from: string; text: string; min: number; react?: { by: string; type: 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' } }
export interface ConversationScript {
  kind: 'DIRECT' | 'GROUP';
  title?: string;
  members: string[];
  startedDaysAgo: number;
  startHour: string;
  /** Number of final messages the main account has not read yet. */
  unreadForMain?: number;
  lines: ScriptLine[];
}

export const CONVERSATIONS: ConversationScript[] = [
  {
    kind: 'DIRECT', members: ['main', 'player01'], startedDaysAgo: 12, startHour: '20:10',
    lines: [
      { from: 'player01', text: 'Chào bạn, tối thứ 5 này có rảnh làm một trận đơn không?', min: 0 },
      { from: 'main', text: 'Có nè, khoảng 19h ở Phúc Thịnh được không?', min: 6 },
      { from: 'player01', text: 'Ok luôn, mình đặt sân 2 tiếng nhé.', min: 9, react: { by: 'main', type: 'LIKE' } },
      { from: 'main', text: 'Tuyệt, hẹn gặp nha 🏸', min: 11 },
      { from: 'player01', text: 'Hôm qua đánh vui ghê, tuần sau tiếp nhé!', min: 60 * 50 },
      { from: 'main', text: 'Chắc chắn rồi!', min: 60 * 50 + 4 },
    ],
  },
  {
    kind: 'DIRECT', members: ['main', 'player03'], startedDaysAgo: 4, startHour: '12:30', unreadForMain: 2,
    lines: [
      { from: 'main', text: 'An ơi, nhóm mình còn thiếu người cho kèo đôi cuối tuần không?', min: 0 },
      { from: 'player03', text: 'Còn 1 suất nè, bạn vào luôn nhé.', min: 15 },
      { from: 'main', text: 'Ok, cho mình một suất!', min: 17, react: { by: 'player03', type: 'LOVE' } },
      { from: 'player03', text: 'Đã thêm bạn vào kèo. Nhớ mang theo cầu nhé, mình hết cầu rồi 😅', min: 60 * 70 },
      { from: 'player03', text: 'À, đổi sang 18h thay vì 19h được không?', min: 60 * 70 + 3 },
    ],
  },
  {
    kind: 'DIRECT', members: ['main', 'player06'], startedDaysAgo: 25, startHour: '21:00',
    lines: [
      { from: 'player06', text: 'Bạn ơi, cú bỏ nhỏ hôm trước bạn tập thế nào mà đẹp vậy?', min: 0 },
      { from: 'main', text: 'Mình tập cầm vợt lỏng tay và đẩy bằng ngón, mỗi buổi 15 phút thôi.', min: 20 },
      { from: 'player06', text: 'Cảm ơn nha, để mình thử.', min: 25, react: { by: 'main', type: 'HAHA' } },
    ],
  },
  {
    kind: 'DIRECT', members: ['main', 'player12'], startedDaysAgo: 1, startHour: '18:40', unreadForMain: 1,
    lines: [
      { from: 'player12', text: 'Chào anh, em là người mới, anh có thể chỉ em chọn vợt cho người mới không ạ?', min: 0 },
    ],
  },
  {
    kind: 'GROUP', title: 'Hội cầu lông tối thứ 3 · Q7', members: ['player02', 'main', 'player04', 'player05', 'player07', 'player09'], startedDaysAgo: 30, startHour: '19:00', unreadForMain: 3,
    lines: [
      { from: 'player02', text: 'Chào cả nhà! Tạo nhóm để hẹn lịch đánh tối thứ 3 hằng tuần nhé.', min: 0 },
      { from: 'player04', text: 'Hay quá, mình tham gia!', min: 5 },
      { from: 'main', text: 'Có mình nữa 🙋', min: 8, react: { by: 'player02', type: 'LIKE' } },
      { from: 'player05', text: 'Mình đặt sân Phúc Thịnh 19h–21h được không mọi người?', min: 60 },
      { from: 'player07', text: 'Ok, chia đều tiền sân nhé.', min: 70 },
      { from: 'player09', text: 'Tuần này mình bận, tuần sau mình vào.', min: 60 * 24 * 6 },
      { from: 'main', text: 'Tuần này đánh vui quá, ai cũng lên tay!', min: 60 * 24 * 7 + 150 },
      { from: 'player02', text: 'Tuần sau mình đổi sang sân Tân Bình thử nhé, nghe nói mới thay đèn.', min: 60 * 24 * 27 },
      { from: 'player04', text: 'Đồng ý!', min: 60 * 24 * 27 + 10 },
      { from: 'player05', text: 'Mình đặt luôn 2 sân cho 8 người nha.', min: 60 * 24 * 27 + 25, react: { by: 'player07', type: 'WOW' } },
    ],
  },
  {
    kind: 'GROUP', title: 'Team đôi nam nữ', members: ['player08', 'player10', 'player11', 'player13'], startedDaysAgo: 18, startHour: '08:15',
    lines: [
      { from: 'player08', text: 'Nhóm luyện đôi nam nữ, mỗi sáng chủ nhật nhé.', min: 0 },
      { from: 'player10', text: 'Ok chị!', min: 3 },
      { from: 'player11', text: 'Em có thể đến muộn 15 phút được không ạ?', min: 40 },
      { from: 'player13', text: 'Được nha, cứ khởi động trước.', min: 45 },
    ],
  },
  {
    kind: 'DIRECT', members: ['player14', 'player15'], startedDaysAgo: 8, startHour: '22:05',
    lines: [
      { from: 'player14', text: 'Mai đánh sớm không bạn?', min: 0 },
      { from: 'player15', text: '5h30 nhé, mình đặt sân rồi.', min: 7 },
    ],
  },
];
