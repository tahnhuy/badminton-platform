/** Demo Social content. Short posts (≤ 300 chars) may use a background card. */
export const FREE_POSTS: Array<{ body: string; background?: 'forest' | 'ocean' | 'sunset' | 'berry' | 'midnight' | 'confetti' }> = [
  { body: 'Mọi người thường khởi động bao lâu trước khi vào sân? Mình đang tập thói quen xoay cổ tay, cổ chân thật kỹ 10 phút. 🏸', background: 'forest' },
  { body: 'Một mẹo nhỏ khi đánh đôi: gọi cầu rõ ràng ("của mình!", "để đó!") giúp cả hai tự tin hơn hẳn. Mọi người còn mẹo phối hợp nào hay không?' },
  { body: 'Buổi tập hôm nay tập trung vào di chuyển ngang sân. Mệt nhưng vui vì giữ nhịp được lâu hơn tuần trước!', background: 'sunset' },
  { body: 'Mọi người đang dùng giày gì cho sân thảm PVC? Mình cần một đôi bám sân tốt, giá tầm 1–1,5 triệu.' },
  { body: 'Chia sẻ lịch tập tuần này: hai buổi kỹ thuật, một buổi giao lưu cuối tuần. Ai thích tập bỏ nhỏ sát lưới thì rủ mình nhé.' },
  { body: 'Cảm ơn cả nhóm đã giao lưu tối qua. Ai cũng fair-play và nhắc nhau khởi động kỹ, chơi rất đã!', background: 'confetti' },
  { body: 'Hôm nay thử dành 15 phút chỉ để tập giao cầu thấp. Bài tập đơn giản nhưng cảm giác cầu cải thiện rõ rệt.' },
  { body: 'Bạn mới chơi đừng ngại hỏi nhé! Mình rất sẵn lòng cùng tập những động tác cơ bản vào sáng cuối tuần.', background: 'ocean' },
  { body: 'Với mình, một buổi chơi tốt là ai cũng được vào sân và ra về vui vẻ. Cùng xây dựng cộng đồng cầu lông tích cực nha!', background: 'berry' },
  { body: 'Vừa đổi sang dây căng 11 kg, đập cầu chắc tay hơn nhưng cần thời gian làm quen. Mọi người căng bao nhiêu kg?' },
  { body: 'Sân Tân Bình Pro mới thay đèn chống chói, đánh cầu cao không còn bị lóa nữa. Khuyên mọi người thử khung 19h–21h.' },
  { body: 'Có ai biết lớp kèm kỹ thuật cho người mới ở khu Quận 7 không? Em mình muốn học bài bản từ đầu.' },
  { body: 'Tip phục hồi: sau buổi đánh nặng mình giãn cơ bắp chân và đùi sau 10 phút, sáng hôm sau đỡ mỏi hẳn.', background: 'midnight' },
  { body: 'Trận đôi nam nữ tối nay căng quá, 3 set mới phân thắng bại. Hẹn đối thủ phục thù tuần sau! 😄' },
  { body: 'Mình đang tìm một bạn đánh đơn trình trung bình để tập đều 2 buổi/tuần, ưu tiên khung 6h sáng.' },
  { body: 'Review nhanh vợt mới: đầu nặng, đập uy lực nhưng phòng thủ hơi chậm. Hợp người chơi tấn công.' },
  { body: 'Cuối tuần này ai rảnh đi xem giải phong trào ở Hoàng Thành không? Nghe nói nhiều cặp đôi mạnh tham gia.', background: 'sunset' },
  { body: 'Ghi chú cho bản thân: đừng đứng quá sát lưới khi đối thủ có cú lốp sâu. Hôm nay mất 5 điểm vì lỗi này 😅' },
  { body: 'Ai có kinh nghiệm chữa đau khuỷu tay khi đánh cầu không? Mình bị nhói mỗi lần đập mạnh.' },
  { body: 'Một tháng tập đều 3 buổi/tuần, thể lực lên thấy rõ. Cảm ơn mọi người trong nhóm đã kéo mình đi chơi!', background: 'forest' },
  { body: 'Hỏi nhanh: sân nào ở Bình Thạnh có giá giờ trưa dễ chịu? Mình làm gần đó, muốn đánh giờ nghỉ trưa.' },
  { body: 'Đánh đôi mà hai người cùng lao lên lưới là toang 😂 Hôm nay rút ra bài học về giữ đội hình trước–sau.' },
  { body: 'Chúc mừng team mình vừa vào bán kết giải nội bộ câu lạc bộ! Cố lên nào!', background: 'confetti' },
  { body: 'Mình mới thử ứng dụng đặt sân ở đây, thanh toán bằng ví nhanh gọn, có thông báo nhắc giờ nữa. Tiện thật.' },
  { body: 'Kỹ thuật cầm vợt kiểu bắt tay vs. cầm vợt trái tay — mọi người chuyển đổi nhanh bằng cách nào?' },
  { body: 'Sáng nay sân vắng, đánh đã ghê. Ai thích chơi sớm thì khung 5h30–7h là lựa chọn số 1.', background: 'ocean' },
];

export const COMMENTS = [
  'Hay quá, cảm ơn bạn đã chia sẻ! 🏸', 'Mình cũng đang gặp đúng vấn đề này.', 'Hôm nào rảnh làm một trận nhé!',
  'Chuẩn luôn, mình thử rồi thấy hiệu quả.', 'Cho mình xin thêm chi tiết với!', 'Đồng ý 100%.',
  'Mình hay căng 10,5 kg, vừa tay.', 'Sân đó đánh tối hơi đông nhưng thảm tốt.', 'Tuyệt vời, chúc mừng team!',
  'Nhớ giãn cơ kỹ nha bạn.', 'Mình đăng ký một suất được không?', 'Haha, ai cũng từng như vậy 😄',
  'Cảm ơn tip, mai mình áp dụng thử.', 'Bạn chơi trình gì vậy? Mình trung bình khá nè.', 'Lần sau rủ mình với!',
  'Đúng là phải gọi cầu to rõ mới phối hợp được.', 'Đôi giày mình đang dùng bám sân khá ổn, để mình gửi tên mẫu.',
  'Khung giờ sáng sớm là chân ái.', 'Mình biết một lớp ở Quận 7, để inbox bạn nhé.', 'Đánh đều tay là lên trình nhanh lắm!',
];

export const REACTIONS = ['LIKE', 'LIKE', 'LIKE', 'LOVE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY'] as const;
