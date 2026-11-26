/**
 * Dán toàn bộ file vào Code.gs tại script.google.com và chạy taoKhaoSat.
 * Tạo bản nháp: mở link chỉnh sửa trong Execution log để xem và xuất bản.
 * Chạy lại cùng dự án trả về form đã tạo, không thêm câu hỏi hoặc tạo bản trùng.
 * Dữ liệu câu hỏi chụp từ docs/research/bo-cau-hoi-khao-sat-nhu-cau.md.
 */
function taoKhaoSat() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    const savedId = props.getProperty('BADMINTON_SURVEY_SHORT_V2_FORM_ID');
    if (savedId) {
      const existing = FormApp.openById(savedId);
      hienThiLienKet_(existing);
      if (props.getProperty('BADMINTON_SURVEY_SHORT_V2_STATUS') !== 'COMPLETE') {
        throw new Error('Lần tạo trước chưa hoàn tất. Form dở dang ở link trên. Để tạo lại, dùng dự án Apps Script mới; script không tự xóa hoặc sửa form cũ.');
      }
      return existing.getEditUrl();
    }

    const form = FormApp.create('Khảo sát nhu cầu tìm bạn chơi, đặt sân và tham gia giải cầu lông', false);
    props.setProperty('BADMINTON_SURVEY_SHORT_V2_FORM_ID', form.getId());
    props.setProperty('BADMINTON_SURVEY_SHORT_V2_STATUS', 'BUILDING');
    console.log('Đã tạo bản nháp: ' + form.getEditUrl());
    form.setDescription(SURVEY_SECTIONS[0].description)
      .setCollectEmail(false)
      .setLimitOneResponsePerUser(false)
      .setProgressBar(true)
      .setShuffleQuestions(false)
      .setPublishingSummary(false)
      .setConfirmationMessage('Cảm ơn bạn đã chia sẻ! Ý kiến của bạn sẽ giúp nhóm xác định những vấn đề thực tế và ưu tiên chức năng phù hợp cho đề tài.');

    const pages = {};
    const questions = {};
    SURVEY_SECTIONS.forEach(function (section) {
      if (section.number === 1) {
        form.addSectionHeaderItem().setTitle(section.title);
      } else {
        pages[section.number] = form.addPageBreakItem().setTitle(section.title);
        if (section.description) pages[section.number].setHelpText(section.description);
      }
      section.questions.forEach(function (q) {
        questions[q.id] = themCauHoi_(form, q);
      });
    });

    // Mỗi đáp án điều hướng đều có đích đến; không pha lựa chọn thường.
    ganNhanh_(questions.C01, [2, 2, 5, 6, 6], pages);
    ganNhanh_(questions.C10, [4, 4, 3, 3], pages);
    ganNhanh_(questions.C13, [5, 6], pages);
    // Các trang còn lại đi tuần tự. Người chưa dự giải bỏ qua Trang 3.

    props.setProperty('BADMINTON_SURVEY_SHORT_V2_STATUS', 'COMPLETE');
    hienThiLienKet_(form);
    console.log('Hoàn tất: 22 câu hỏi, 6 phần. Mở link chỉnh sửa, xem trước và Xuất bản để nhận phản hồi.');
    return form.getEditUrl();
  } finally {
    lock.releaseLock();
  }
}

function themCauHoi_(form, q) {
  const methods = {
    text: 'addTextItem', paragraph: 'addParagraphTextItem',
    choice: 'addMultipleChoiceItem', checkbox: 'addCheckboxItem',
    list: 'addListItem', grid: 'addGridItem', scale: 'addScaleItem'
  };
  if (!methods[q.type]) throw new Error('Kiểu câu hỏi không hỗ trợ: ' + q.type);
  const item = form[methods[q.type]]();
  item.setTitle(q.id + '. ' + q.title + '?').setRequired(q.required);
  if (q.help) item.setHelpText(q.help);
  if (q.options) item.setChoiceValues(q.options);
  if (q.other) item.showOtherOption(true);
  if (q.type === 'grid') item.setRows(q.rows).setColumns(q.columns);
  if (q.type === 'scale') item.setBounds(1, 5).setLabels(q.labels[0], q.labels[1]);
  if (q.maxChoices) {
    item.setValidation(FormApp.createCheckboxValidation()
      .requireSelectAtMost(q.maxChoices)
      .setHelpText('Vui lòng chọn tối đa ' + q.maxChoices + ' đáp án.')
      .build());
  }
  return item;
}

function ganNhanh_(item, destinations, pages) {
  const choices = item.getChoices();
  if (choices.length !== destinations.length) throw new Error('Số lựa chọn điều hướng không khớp.');
  item.setChoices(choices.map(function (choice, index) {
    return item.createChoice(choice.getValue(), pages[destinations[index]]);
  }));
}

function hienThiLienKet_(form) {
  console.log('Link chỉnh sửa: ' + form.getEditUrl());
  console.log('Link trả lời (dùng sau khi xuất bản): ' + form.getPublishedUrl());
}

const SURVEY_SECTIONS =
[
  {
    "number": 1,
    "title": "Giới thiệu và nhóm người trả lời",
    "description": "Chào bạn! Nhóm thực hiện đề tài “Số hóa hệ sinh thái cầu lông” muốn tìm hiểu khó khăn thực tế khi tìm bạn chơi, đặt sân và tham gia hoặc tổ chức giải đấu. Khảo sát dự kiến mất 4–6 phút tùy nhánh.\n\nKhông yêu cầu họ tên, email hoặc số điện thoại. Vui lòng không nhập thông tin định danh vào câu trả lời mở. Dữ liệu được tổng hợp phục vụ đề tài. Chúng tôi mong nhận được cả nhu cầu sử dụng lẫn lý do bạn hài lòng với cách hiện tại.",
    "questions": [
      {
        "id": "C01",
        "title": "Lựa chọn nào mô tả đúng nhất tình trạng hiện tại của bạn",
        "type": "choice",
        "required": true,
        "other": false,
        "options": [
          "Tôi chơi cầu lông và không quản lý hoặc kinh doanh sân.",
          "Tôi vừa chơi cầu lông vừa quản lý hoặc kinh doanh sân.",
          "Tôi quản lý hoặc kinh doanh sân nhưng không chơi cầu lông.",
          "Tôi chưa chơi nhưng có dự định bắt đầu.",
          "Tôi không thuộc các nhóm trên."
        ]
      }
    ]
  },
  {
    "number": 2,
    "title": "Tìm người chơi và đặt sân",
    "description": "Trả lời theo trải nghiệm trong 3 tháng gần đây. “Kèo” là buổi hẹn chơi hoặc giao lưu có người đứng ra tổ chức và tuyển thêm người.",
    "questions": [
      {
        "id": "C02",
        "title": "Bạn thường chơi cầu lông tại tỉnh hoặc thành phố nào",
        "type": "text",
        "required": true,
        "help": "Chỉ ghi tỉnh/thành phố, không cần địa chỉ cụ thể. Có thể ghi “Chưa có địa điểm cố định”."
      },
      {
        "id": "C03",
        "title": "Trong 3 tháng gần đây bạn chơi cầu lông với tần suất nào",
        "type": "list",
        "required": true,
        "other": false,
        "options": [
          "Chưa có buổi nào.",
          "Ít hơn 1 buổi/tháng.",
          "Từ 1 đến 3 buổi/tháng.",
          "Từ 1 đến 2 buổi/tuần.",
          "Từ 3 buổi/tuần trở lên."
        ]
      },
      {
        "id": "C04",
        "title": "Bạn đang dùng những cách nào để tìm người chơi cùng hoặc buổi giao lưu",
        "type": "checkbox",
        "required": true,
        "other": true,
        "options": [
          "Chơi với nhóm quen cố định.",
          "Nhờ bạn bè giới thiệu.",
          "Nhóm hoặc bài đăng Facebook.",
          "Nhóm hoặc tin nhắn Zalo.",
          "Nhờ chủ sân hoặc người quản lý sân giới thiệu.",
          "Ứng dụng hoặc website chuyên về thể thao.",
          "Chưa từng tìm người chơi cùng. Chỉ chọn đáp án này nếu không chọn đáp án khác."
        ]
      },
      {
        "id": "C05",
        "title": "Bạn gặp các tình huống sau thường xuyên đến mức nào",
        "type": "grid",
        "required": true,
        "rows": [
          "Khó tìm người phù hợp khu vực và lịch rảnh.",
          "Khó biết trình độ thực tế của người chơi mới.",
          "Bài tìm người bị trôi hoặc không rõ còn chỗ.",
          "Có người hủy sát giờ hoặc không đến."
        ],
        "columns": [
          "Chưa bao giờ",
          "Hiếm khi",
          "Thỉnh thoảng",
          "Thường xuyên",
          "Rất thường xuyên",
          "Chưa có trải nghiệm"
        ]
      },
      {
        "id": "C06",
        "title": "Khi cân nhắc tham gia một kèo bạn ưu tiên thông tin nào nhất",
        "type": "checkbox",
        "required": true,
        "maxChoices": 3,
        "help": "Chọn tối đa 3 đáp án.",
        "other": true,
        "options": [
          "Thời gian chơi.",
          "Khu vực hoặc sân cụ thể.",
          "Trình độ phù hợp.",
          "Số chỗ còn trống.",
          "Chi phí dự kiến mỗi người.",
          "Thông tin người tổ chức và người tham gia.",
          "Hình thức chơi đơn, đôi hoặc giao lưu nhóm.",
          "Tôi chưa có nhu cầu tham gia kèo. Chỉ chọn đáp án này nếu không chọn đáp án khác."
        ]
      },
      {
        "id": "C07",
        "title": "Hiện tại bạn thường đặt sân bằng cách nào",
        "type": "choice",
        "required": true,
        "other": true,
        "options": [
          "Gọi điện cho sân.",
          "Nhắn Zalo, Facebook hoặc ứng dụng nhắn tin khác.",
          "Đến sân đặt trực tiếp.",
          "Đặt qua ứng dụng hoặc website.",
          "Chơi theo lịch cố định đã thỏa thuận với sân.",
          "Người khác đặt giúp, tôi không trực tiếp đặt.",
          "Chưa từng đặt hoặc nhờ đặt sân."
        ]
      },
      {
        "id": "C08",
        "title": "Bạn từng gặp những vấn đề nào liên quan đến đặt sân trong 3 tháng gần đây",
        "type": "checkbox",
        "required": true,
        "other": true,
        "options": [
          "Không biết khung giờ nào còn trống.",
          "Phải chờ sân trả lời hoặc xác nhận lâu.",
          "Giá theo khung giờ hoặc phụ phí chưa rõ.",
          "Sân đã được đặt nhưng lịch chưa cập nhật, dẫn đến trùng lịch.",
          "Sân hủy hoặc thay đổi lịch sát giờ.",
          "Không rõ điều kiện hủy và số tiền được hoàn.",
          "Khó theo dõi tiền đã trả hoặc tiền hoàn.",
          "Không gặp vấn đề nào. Chỉ chọn đáp án này nếu không chọn đáp án khác.",
          "Chưa có trải nghiệm. Chỉ chọn đáp án này nếu không chọn đáp án khác."
        ]
      },
      {
        "id": "C09",
        "title": "Bạn ưu tiên cách thanh toán nào khi đặt sân trực tuyến",
        "type": "choice",
        "required": true,
        "other": false,
        "options": [
          "Thanh toán trực tiếp từng lần qua ngân hàng hoặc ví điện tử.",
          "Nạp vào số dư nội bộ của nền tảng rồi dùng số dư để thanh toán.",
          "Đặt cọc trước một phần, thanh toán phần còn lại tại sân.",
          "Thanh toán toàn bộ tại sân.",
          "Không có ưu tiên.",
          "Chưa có ý kiến."
        ]
      },
      {
        "id": "C10",
        "title": "Trải nghiệm của bạn với giải đấu cầu lông trong 12 tháng gần đây là gì",
        "type": "choice",
        "required": true,
        "other": false,
        "options": [
          "Chưa từng tham gia hoặc tổ chức.",
          "Có dự định nhưng chưa tham gia hoặc tổ chức.",
          "Đã tham gia với tư cách vận động viên, chưa tổ chức.",
          "Đã tổ chức hoặc tham gia ban tổ chức, có thể đồng thời là vận động viên."
        ]
      }
    ]
  },
  {
    "number": 3,
    "title": "Tham gia và tổ chức giải đấu",
    "description": "Trả lời theo trải nghiệm trong 12 tháng gần đây. Nếu chưa trực tiếp tổ chức, chọn những vấn đề bạn gặp với tư cách người dự giải.",
    "questions": [
      {
        "id": "C11",
        "title": "Bạn gặp khó khăn nào khi tham gia hoặc tổ chức giải cầu lông",
        "type": "checkbox",
        "required": true,
        "options": [
          "Khó tìm thông tin giải hoặc nội dung phù hợp trình độ.",
          "Khó theo dõi đăng ký và lệ phí.",
          "Khó kiểm tra điều kiện hoặc trình độ người tham dự.",
          "Tốn công bốc thăm, xếp hạt giống hoặc xử lý suất miễn vòng đầu.",
          "Lịch bị trùng sân hoặc vận động viên.",
          "Khó cập nhật lịch, sơ đồ đấu và kết quả.",
          "Không gặp khó khăn đáng kể. Chỉ chọn đáp án này nếu không chọn đáp án khác."
        ],
        "other": true
      },
      {
        "id": "C12",
        "title": "Bạn muốn được hỗ trợ những công việc nào nhất liên quan đến giải đấu",
        "type": "checkbox",
        "required": true,
        "options": [
          "Tìm giải và đăng ký nội dung đơn hoặc đôi trực tuyến.",
          "Quản lý danh sách đăng ký và lệ phí.",
          "Tạo sơ đồ đấu có xét hạt giống và suất miễn vòng đầu.",
          "Xếp lịch tránh trùng sân và vận động viên.",
          "Theo dõi lịch, kết quả và nhận thông báo thay đổi.",
          "Lưu thành tích có xác nhận vào hồ sơ người chơi.",
          "Chưa cần các hỗ trợ này. Chỉ chọn đáp án này nếu không chọn đáp án khác."
        ],
        "other": true,
        "maxChoices": 3,
        "help": "Chọn tối đa 3 đáp án."
      }
    ]
  },
  {
    "number": 4,
    "title": "Chuyển đến phần phù hợp",
    "description": "",
    "questions": [
      {
        "id": "C13",
        "title": "Hiện bạn có trực tiếp quản lý hoặc kinh doanh sân cầu lông không",
        "type": "choice",
        "required": true,
        "other": false,
        "options": [
          "Có.",
          "Không."
        ]
      }
    ]
  },
  {
    "number": 5,
    "title": "Quản lý và vận hành sân",
    "description": "Dành cho người trực tiếp quản lý hoặc kinh doanh sân. Nếu phụ trách nhiều cơ sở, hãy chọn một cơ sở bạn nắm rõ nhất. Các câu về khó khăn xét trong 3 tháng gần đây.",
    "questions": [
      {
        "id": "C14",
        "title": "Cơ sở bạn đang phụ trách có bao nhiêu sân cầu lông",
        "type": "list",
        "required": true,
        "other": false,
        "options": [
          "1–2 sân.",
          "3–5 sân.",
          "6–10 sân.",
          "Trên 10 sân."
        ]
      },
      {
        "id": "C15",
        "title": "Bạn hiện dùng cách nào để ghi nhận và quản lý lịch sân",
        "type": "checkbox",
        "required": true,
        "other": true,
        "options": [
          "Sổ hoặc bảng ghi chép.",
          "Excel hoặc Google Sheets.",
          "Lịch trên điện thoại hoặc Google Calendar.",
          "Lịch sử tin nhắn Zalo hoặc Facebook.",
          "Phần mềm quản lý sân.",
          "Chưa có công cụ theo dõi cố định. Chỉ chọn đáp án này nếu không chọn đáp án khác."
        ]
      },
      {
        "id": "C16",
        "title": "Trong 3 tháng gần đây cơ sở gặp các tình huống sau thường xuyên đến mức nào",
        "type": "grid",
        "required": true,
        "rows": [
          "Lịch nhận qua nhiều kênh khó tổng hợp hoặc bị trùng.",
          "Khách hủy sát giờ hoặc không đến.",
          "Mất thời gian trả lời giờ trống và giá sân.",
          "Khó đối soát tiền thu hoặc xử lý hoàn tiền khi có sự cố."
        ],
        "columns": [
          "Chưa bao giờ",
          "Hiếm khi",
          "Thỉnh thoảng",
          "Thường xuyên",
          "Rất thường xuyên",
          "Không nắm thông tin"
        ]
      },
      {
        "id": "C17",
        "title": "Bạn cần các chức năng quản lý sân sau ở mức độ nào",
        "type": "grid",
        "required": true,
        "rows": [
          "Lịch trống và lượt đặt cập nhật theo thời gian thực.",
          "Cấu hình giá theo ngày và khung giờ.",
          "Khóa giờ bảo trì, thông báo và hoàn tiền khi sân hủy.",
          "Theo dõi doanh thu, giao dịch và rút tiền để đối soát."
        ],
        "columns": [
          "1 Không cần thiết",
          "2 Ít cần thiết",
          "3 Bình thường",
          "4 Cần thiết",
          "5 Rất cần thiết",
          "Chưa rõ hoặc không áp dụng"
        ]
      },
      {
        "id": "C18",
        "title": "Bạn sẵn sàng áp dụng xác nhận đặt sân tự động sau khi khách thanh toán ở mức độ nào",
        "type": "choice",
        "required": true,
        "help": "Khách chọn khung giờ còn trống trên hệ thống; sau khi thanh toán thành công, lịch được xác nhận và cập nhật mà không cần chủ sân duyệt từng lượt.",
        "other": false,
        "options": [
          "Hoàn toàn chưa sẵn sàng.",
          "Ít sẵn sàng.",
          "Cần tìm hiểu thêm.",
          "Sẵn sàng.",
          "Rất sẵn sàng."
        ]
      }
    ]
  },
  {
    "number": 6,
    "title": "Ưu tiên và góp ý",
    "description": "Đánh giá theo nhu cầu hiện tại. Nếu chưa chơi cầu lông, trả lời theo điều bạn mong đợi khi bắt đầu.",
    "questions": [
      {
        "id": "C19",
        "title": "Nếu có một nền tảng cầu lông mới bạn muốn ưu tiên những nhóm chức năng nào",
        "type": "checkbox",
        "required": true,
        "maxChoices": 3,
        "help": "Chọn tối đa 3 đáp án.",
        "other": true,
        "options": [
          "Tìm kèo và tuyển người chơi phù hợp.",
          "Tìm sân trống và đặt sân trực tuyến.",
          "Quản lý thanh toán, chia tiền và tra cứu hoàn tiền.",
          "Tìm và đăng ký giải đấu.",
          "Quản lý tổ chức giải, sơ đồ đấu và lịch thi đấu.",
          "Hồ sơ trình độ và thành tích.",
          "Nhắn tin riêng hoặc theo nhóm kèo.",
          "Bảng tin chia sẻ cộng đồng.",
          "Tôi chưa cần nền tảng mới. Chỉ chọn đáp án này nếu không chọn đáp án khác."
        ]
      },
      {
        "id": "C20",
        "title": "Những điều gì có thể khiến bạn không sử dụng một nền tảng cầu lông mới",
        "type": "checkbox",
        "required": true,
        "other": true,
        "options": [
          "Đã hài lòng với Facebook, Zalo hoặc cách hiện tại.",
          "Ít người chơi hoặc ít sân ở khu vực của tôi.",
          "Thông tin lịch sân hoặc kèo không đáng tin cậy.",
          "Quy trình đăng ký và sử dụng mất thời gian.",
          "Lo ngại dữ liệu cá nhân.",
          "Không muốn nạp tiền vào số dư nội bộ.",
          "Phí sử dụng hoặc phí giao dịch.",
          "Không muốn chuyển sang một ứng dụng khác.",
          "Chưa thấy trở ngại đáng kể. Chỉ chọn đáp án này nếu không chọn đáp án khác."
        ]
      },
      {
        "id": "C21",
        "title": "Nếu nền tảng đáp ứng nhu cầu của bạn khả năng bạn dùng thử là bao nhiêu",
        "type": "scale",
        "required": true,
        "labels": [
          "Chắc chắn không dùng thử",
          "Chắc chắn sẽ dùng thử"
        ]
      },
      {
        "id": "C22",
        "title": "Theo bạn vấn đề quan trọng nhất mà một nền tảng cầu lông cần giải quyết là gì",
        "type": "paragraph",
        "required": false,
        "help": "Bạn có thể nêu nhu cầu chưa được hỏi, góp ý về một chức năng hoặc lý do bạn không cần nền tảng này."
      }
    ]
  }
];
