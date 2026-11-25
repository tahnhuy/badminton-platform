/* Dữ liệu minh họa cho bản mẫu — không phải dữ liệu thật, không gọi API. */
window.SP_DATA = (() => {
  const levels = [
    { rank: 1, code: 'BEGINNER', name: 'Mới chơi' },
    { rank: 2, code: 'WEAK', name: 'Yếu' },
    { rank: 3, code: 'AVERAGE_MINUS', name: 'TB yếu' },
    { rank: 4, code: 'AVERAGE', name: 'Trung bình' },
    { rank: 5, code: 'AVERAGE_PLUS', name: 'TB khá' },
    { rank: 6, code: 'GOOD', name: 'Khá' },
    { rank: 7, code: 'EXCELLENT', name: 'Giỏi' },
  ];

  const players = [
    ['Nguyễn Minh Khang', 6], ['Trần Bảo Ngọc', 6], ['Lê Hoàng Phúc', 5], ['Phạm Thu Hà', 5],
    ['Võ Đức Anh', 5], ['Đặng Quỳnh Như', 4], ['Bùi Gia Huy', 4], ['Hồ Thanh Tâm', 4],
  ].map(([name, rank], i) => ({ id: 100 + i, name, rank, initials: name.split(' ').slice(-2).map(w => w[0]).join('') }));

  const tournaments = [
    {
      id: 1, name: 'Giải đơn nam nữ mùa đông 2026', matchType: 'SINGLES', status: 'IN_PROGRESS', fee: 150000,
      minRank: 4, maxRank: 6, limit: 8, confirmed: 8, venue: 'Nhà thi đấu Phú Thọ, 1 Lữ Gia, Q.11, TP.HCM',
      regEnd: '2026-12-05T23:59', start: '2026-12-07T08:00', end: '2026-12-07T21:00',
      organizer: 'Nguyễn Văn Tài', courts: 2, duration: 45, rest: 15, dayStart: '08:00', dayEnd: '21:00',
      description: 'Giải đơn mở rộng cho trình Trung bình đến Khá. Mỗi trận 3 set, set 21 điểm, cách 2 điểm, tối đa 30. Có mặt trước giờ thi đấu 15 phút; vắng mặt bị xử thua.',
    },
    { id: 2, name: 'Cúp đôi phong cách – Quận 7', matchType: 'DOUBLES', status: 'OPEN_FOR_REGISTRATION', fee: 200000, minRank: 3, maxRank: 5, limit: 16, confirmed: 9, venue: 'Sân CLB Sunrise, Q.7', regEnd: '2026-12-10T22:00', start: '2026-12-14T07:30', end: '2026-12-14T20:00', organizer: 'Lê Thị Mai' },
    { id: 3, name: 'Giải đơn trẻ – miễn phí', matchType: 'SINGLES', status: 'OPEN_FOR_REGISTRATION', fee: 0, minRank: null, maxRank: 3, limit: 32, confirmed: 21, venue: 'Nhà văn hóa Thanh niên, Q.1', regEnd: '2026-12-08T20:00', start: '2026-12-12T08:00', end: '2026-12-13T18:00', organizer: 'Đoàn Phương' },
    { id: 4, name: 'Giải Khá – Giỏi Tân Bình', matchType: 'SINGLES', status: 'READY', fee: 300000, minRank: 6, maxRank: 7, limit: 16, confirmed: 12, venue: 'Sân Hoàng Hoa Thám, Tân Bình', regEnd: '2026-12-01T22:00', start: '2026-12-06T08:00', end: '2026-12-06T20:00', organizer: 'Phan Khôi' },
    { id: 5, name: 'Giao hữu đôi nam nữ cuối năm', matchType: 'DOUBLES', status: 'COMPLETED', fee: 100000, minRank: null, maxRank: null, limit: 8, confirmed: 8, venue: 'Sân Kỳ Hòa, Q.10', regEnd: '2026-11-20T22:00', start: '2026-11-23T08:00', end: '2026-11-23T17:00', organizer: 'Mai Anh' },
    { id: 6, name: 'Giải đơn sinh viên HCMUTE', matchType: 'SINGLES', status: 'CANCELLED', fee: 50000, minRank: 2, maxRank: 5, limit: 16, confirmed: 1, venue: 'Nhà thi đấu HCMUTE, TP. Thủ Đức', regEnd: '2026-11-18T22:00', start: '2026-11-22T08:00', end: '2026-11-22T18:00', organizer: 'CLB Cầu lông UTE' },
  ];

  /* Nhánh đấu 8 người của giải #1: tứ kết xong, bán kết 1 đang đánh, bán kết 2 chờ, chung kết chưa biết. */
  const P = id => players.find(p => p.id === id);
  const bracket = [
    { round: 0, matches: [
      { id: 11, a: { p: P(100), seed: 1 }, b: { p: P(107), seed: 8 }, sets: [[21, 12], [21, 16]], winner: 'a', status: 'COMPLETED', court: 'Sân 1', time: '08:00' },
      { id: 12, a: { p: P(103), seed: 4 }, b: { p: P(104), seed: 5 }, sets: [[19, 21], [21, 18], [24, 22]], winner: 'a', status: 'COMPLETED', court: 'Sân 2', time: '08:00' },
      { id: 13, a: { p: P(102), seed: 3 }, b: { p: P(105), seed: 6 }, sets: [[21, 18], [9, 11]], winner: 'b', status: 'COMPLETED', court: 'Sân 1', time: '08:45', resolution: 'RETIRED', note: 'Bỏ cuộc (chấn thương)' },
      { id: 14, a: { p: P(101), seed: 2 }, b: { p: P(106), seed: 7 }, sets: [], winner: 'a', status: 'COMPLETED', court: 'Sân 2', time: '08:45', resolution: 'WALKOVER', note: 'Walkover (vắng mặt)' },
    ] },
    { round: 1, matches: [
      { id: 21, a: { p: P(100), seed: 1 }, b: { p: P(103), seed: 4 }, sets: [[21, 17], [14, 9]], status: 'IN_PROGRESS', court: 'Sân 1', time: '09:30' },
      { id: 22, a: { p: P(105), seed: 6 }, b: { p: P(101), seed: 2 }, sets: [], status: 'CONFIRMED', court: 'Sân 2', time: '09:40' },
    ] },
    { round: 2, matches: [{ id: 31, a: null, b: null, sets: [], status: 'CONFIRMED', court: 'Sân 1', time: '10:45' }] },
  ];

  const wallet = { balance: 420000 };
  return { levels, players, tournaments, bracket, wallet };
})();
