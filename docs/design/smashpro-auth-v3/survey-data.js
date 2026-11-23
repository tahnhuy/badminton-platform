/*
 * SmashPro prototype v3 — survey version 1 (local copy for the prototype only).
 *
 * In the real app the frontend gets SURVEY from `GET /api/v1/auth/skill-survey`
 * and never sees SCORING (option scores, weights, bands, guardrail references):
 * scoring happens on the server. They are kept in two separate objects here so
 * that the split stays visible.
 * Wording: Auth PRD, "Registration skill survey — content updated 2026-11-15".
 */
(function (root) {
  const SURVEY = {
    version: 1,
    steps: [
      { id: 'background', title: 'Tiểu sử & thói quen', hint: 'Khởi đầu câu chuyện của bạn', eyebrow: 'Hiểu hành trình của bạn', heading: 'Bạn đã gắn bó với cầu lông thế nào?', lead: 'Vài câu về thời gian chơi và cách bạn học. Không có câu trả lời đúng hay sai.', questionIds: ['yearsPlaying', 'frequencyPerWeek', 'coaching', 'returningAfterBreak'] },
      { id: 'technique', title: 'Kỹ thuật', hint: 'Cách bạn làm chủ đường cầu', eyebrow: 'Hiểu cách bạn chơi', heading: 'Bạn tự tin với đường cầu nào?', lead: 'Chọn mô tả gần nhất với cách bạn thường chơi hiện tại.', questionIds: ['skill.service', 'skill.clear', 'skill.smash', 'skill.netPlay', 'skill.defense', 'skill.drive', 'skill.backhand', 'skill.footwork', 'skill.doublesPlay'] },
      { id: 'play', title: 'Thực chiến & thể lực', hint: 'Nhịp độ trên sân', eyebrow: 'Nhịp độ trên sân', heading: 'Khi vào trận, bạn trụ được đến đâu?', lead: 'Nghĩ về những buổi chơi gần đây với người cùng trình độ.', questionIds: ['rallyConsistency', 'stamina'] },
      { id: 'achievement', title: 'Thành tích thi đấu', hint: 'Những cột mốc đã qua', eyebrow: 'Những cột mốc đã qua', heading: 'Thành tích cao nhất của bạn là gì?', lead: 'Chỉ tính khi bạn đạt giải Nhất, Nhì hoặc Ba. Chưa có giải cũng hoàn toàn bình thường.', questionIds: ['tournamentAchievement'] },
      { id: 'account', title: 'Tạo tài khoản', hint: 'Sẵn sàng kết nối', eyebrow: 'Bước cuối cùng', heading: 'Tạo tài khoản SmashPro', lead: 'Xem lại câu trả lời, sau đó tạo tài khoản để nhận trình độ ban đầu.', questionIds: [] },
    ],
    skillScale: [
      { value: 0, label: 'Chưa làm được', hint: 'Mình chưa thực hiện được kỹ thuật này' },
      { value: 1, label: 'Làm được khi cầu chậm/dễ', hint: 'Thực hiện được khi có thời gian chuẩn bị' },
      { value: 2, label: 'Ổn định khi đánh giao lưu', hint: 'Đều tay trong các buổi chơi thường ngày' },
      { value: 3, label: 'Ổn định cả khi bị ép tốc độ cao', hint: 'Vẫn chính xác khi đối phương tăng nhịp' },
    ],
    questions: {
      yearsPlaying: { type: 'CHOICE', visual: 'timeline', text: 'Tổng thời gian bạn thực sự chơi cầu lông là bao lâu?', description: 'Không tính các giai đoạn nghỉ.', options: [
        { code: 'LESS_THAN_6M', label: 'Dưới 6 tháng', short: '< 6 th' },
        { code: '6M_TO_1Y', label: '6 tháng – dưới 1 năm', short: '6 th–1 năm' },
        { code: '1Y_TO_2Y', label: '1 – dưới 2 năm', short: '1–2 năm' },
        { code: '2Y_TO_4Y', label: '2 – dưới 4 năm', short: '2–4 năm' },
        { code: '4Y_TO_7Y', label: '4 – dưới 7 năm', short: '4–7 năm' },
        { code: '7Y_PLUS', label: 'Từ 7 năm trở lên', short: '7+ năm' },
      ] },
      frequencyPerWeek: { type: 'CHOICE', visual: 'dots', text: 'Hiện tại bạn chơi trung bình bao nhiêu buổi mỗi tuần?', options: [
        { code: 'LESS_THAN_1', label: 'Dưới 1 buổi' },
        { code: 'ONE', label: '1 buổi' },
        { code: 'TWO_TO_THREE', label: '2–3 buổi' },
        { code: 'FOUR_PLUS', label: 'Từ 4 buổi trở lên' },
      ] },
      coaching: { type: 'CHOICE', visual: 'cards', text: 'Bạn đã từng học cầu lông bài bản chưa?', options: [
        { code: 'NONE', label: 'Chưa từng học', icon: 'Shuttlecock' },
        { code: 'SELF_TAUGHT', label: 'Tự học qua video/bạn bè', icon: 'UsersRound' },
        { code: 'COACH_LESS_THAN_6M', label: 'Học lớp cơ bản/HLV dưới 6 tháng', icon: 'GraduationCap' },
        { code: 'COACH_6M_PLUS', label: 'Học có giáo trình từ 6 tháng trở lên', icon: 'Target' },
        { code: 'TALENT_TEAM', label: 'Từng ở đội tuyển/lớp năng khiếu', icon: 'Trophy' },
      ] },
      returningAfterBreak: { type: 'BOOLEAN', visual: 'toggle', text: 'Bạn có đang quay lại chơi sau một thời gian nghỉ liên tục trên 6 tháng, và mới chơi lại chưa đến 3 tháng không?', hiddenWhen: { questionId: 'yearsPlaying', optionCode: 'LESS_THAN_6M' }, options: [
        { code: 'false', label: 'Không' },
        { code: 'true', label: 'Có, mình đang quay lại' },
      ] },
      'skill.service': { type: 'SKILL', text: 'Giao cầu', description: 'Giao cầu ngắn sát lưới và giao cầu cao sâu cuối sân.', art: 'service' },
      'skill.clear': { type: 'SKILL', text: 'Phông cầu', description: 'Từ cuối sân đánh cầu cao sâu về sát cuối sân đối phương.', art: 'clear' },
      'skill.smash': { type: 'SKILL', text: 'Đập cầu', description: 'Đập cầu cắm, có lực và điều chỉnh được hướng.', art: 'smash' },
      'skill.netPlay': { type: 'SKILL', text: 'Bỏ nhỏ / cầu lưới', description: 'Bỏ nhỏ, ve, móc cầu sát mép lưới.', art: 'net' },
      'skill.defense': { type: 'SKILL', text: 'Thủ cầu', description: 'Đỡ đập, hất cầu cao sâu thoát hiểm khi bị tấn công.', art: 'defense' },
      'skill.drive': { type: 'SKILL', text: 'Tạt cầu & phản tạt', description: 'Đánh cầu ngang lưới tốc độ nhanh, chủ động hoặc phản tạt khi bị ép.', art: 'drive' },
      'skill.backhand': { type: 'SKILL', text: 'Trái tay', description: 'Đánh trái tay từ cuối sân qua lưới để thoát thế bị động.', art: 'backhand' },
      'skill.footwork': { type: 'SKILL', text: 'Bộ pháp', description: 'Di chuyển bao các góc sân và hồi về vị trí trung tâm.', art: 'footwork' },
      'skill.doublesPlay': { type: 'SKILL', text: 'Phối hợp đánh đôi', description: 'Hiểu vị trí tấn công (trên–dưới) và phòng thủ (hai bên), biết bọc lót đồng đội.', art: 'doubles' },
      rallyConsistency: { type: 'CHOICE', visual: 'rally', text: 'Khi đánh qua lại giằng co với người cùng trình độ, bạn thường giữ được bao nhiêu lượt chạm cầu trước khi chính bạn đánh hỏng?', description: 'Đếm cả hai bên: bạn đánh, đối phương đánh lại là 2 lượt.', options: [
        { code: 'LESS_THAN_5', label: 'Dưới 5 lượt', count: 1 },
        { code: '5_TO_9', label: '5–9 lượt', count: 2 },
        { code: '10_TO_14', label: '10–14 lượt', count: 3 },
        { code: '15_TO_19', label: '15–19 lượt', count: 4 },
        { code: '20_PLUS', label: 'Từ 20 lượt trở lên', count: 5 },
        { code: '20_PLUS_ATTACKING', label: 'Từ 20 lượt và thường chủ động kết thúc bằng tấn công', count: 6 },
      ] },
      stamina: { type: 'CHOICE', visual: 'energy', text: 'Trong một buổi chơi, bạn duy trì được chất lượng đánh như thế nào?', options: [
        { code: 'UNDER_20M', label: 'Hụt hơi trước 20 phút' },
        { code: '20_TO_40M', label: 'Trụ được 20–40 phút' },
        { code: 'ONE_HOUR_FADES_GAME_3', label: 'Khoảng 1 giờ, tụt sức ở ván 3' },
        { code: 'THREE_GAMES', label: 'Giữ phong độ qua cả 3 ván' },
        { code: 'MULTIPLE_MATCHES', label: 'Nhiều trận liên tục vẫn giữ chất lượng' },
      ] },
      tournamentAchievement: { type: 'CHOICE', visual: 'medals', text: 'Thành tích thi đấu cao nhất bạn từng đạt được là gì?', description: 'Chỉ tính khi đạt giải Nhất, Nhì hoặc Ba.', options: [
        { code: 'NONE', label: 'Chưa từng đạt giải', tier: 0 },
        { code: 'INTERNAL', label: 'Giải nội bộ CLB/công ty/trường', tier: 1 },
        { code: 'DISTRICT_OR_STUDENT', label: 'Giải cấp quận/huyện hoặc giải sinh viên', tier: 2 },
        { code: 'PROVINCIAL_MEDAL', label: 'Huy chương giải cấp tỉnh/thành phố', tier: 3 },
        { code: 'NATIONAL_OR_PRO', label: 'Giải cấp quốc gia hoặc thi đấu chuyên nghiệp', tier: 4 },
      ] },
    },
  };

  /* Server-only data (matrix §1.2, Tech Design "Version 1 definition"). */
  const SCORING = {
    weights: { K: 0.40, R: 0.20, X: 0.15, P: 0.10, A: 0.10, T: 0.05 },
    experienceMix: { years: 0.7, frequency: 0.3 },
    returningPenalty: 15,
    bands: [0, 15, 30, 45, 60, 70, 80],
    rallyRef: [1, 2, 3, 4, 5, 6],
    staminaRef: [2, 3, 4, 5, 6],
    experienceCap: { LESS_THAN_6M: 3, '6M_TO_1Y': 4 },
  };

  const LEVELS = [
    { rank: 1, code: 'BEGINNER', name: 'Mới chơi', description: 'Mới làm quen; chủ yếu cố đưa cầu qua lưới; chưa giữ được cầu qua lại ổn định.' },
    { rank: 2, code: 'WEAK', name: 'Yếu', description: 'Đánh qua lại được ở tốc độ chậm; kỹ thuật cơ bản chưa vững; di chuyển chưa hiệu quả.' },
    { rank: 3, code: 'AVERAGE_MINUS', name: 'Trung bình yếu', description: 'Thực hiện được phông, bỏ nhỏ, đập cầu ở mức nhất định nhưng chưa kiểm soát lực và điểm rơi.' },
    { rank: 4, code: 'AVERAGE', name: 'Trung bình', description: 'Kỹ thuật cơ bản tương đối đều; duy trì pha cầu ổn định hơn; chơi đôi hiểu vị trí.' },
    { rank: 5, code: 'AVERAGE_PLUS', name: 'Trung bình khá', description: 'Kỹ thuật vững, ít lỗi tự đánh hỏng; phối hợp đôi tốt; bắt đầu vận dụng chiến thuật.' },
    { rank: 6, code: 'GOOD', name: 'Khá', description: 'Kỹ thuật toàn diện, độ ổn định cao; đọc trận đấu và điều chỉnh chiến thuật theo đối thủ.' },
    { rank: 7, code: 'EXCELLENT', name: 'Giỏi', description: 'Kỹ thuật chuyên sâu, chính xác dưới áp lực; công thủ tốc độ cao; thường đã có thành tích thi đấu.' },
  ];

  const api = { SURVEY, SCORING, LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SmashProSurveyData = api;
})(typeof window !== 'undefined' ? window : globalThis);
