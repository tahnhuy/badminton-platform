export const EMAIL_TEMPLATES = [
  'REGISTER_OTP',
  'PASSWORD_RESET_OTP',
  'PASSWORD_CHANGE_OTP',
  'WITHDRAWAL_PIN_RESET_OTP',
  'ADMIN_PASSWORD_RESET',
  'OWNER_REQUEST_RECEIVED',
  'OWNER_ACCOUNT_CREATED',
  'OWNER_REQUEST_REJECTED',
] as const;

export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export interface EmailTemplateData {
  otp?: string;
  expiresInMinutes?: number;
  /** Only used by the Admin reset notification; the temporary password is never emailed. */
  adminEmail?: string;
  /** Partnership request emails (partnership-request Tech Design §8). Never a password. */
  contactName?: string;
  facilityName?: string;
  accountEmail?: string;
  actionUrl?: string;
  reason?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

type OtpTemplate = 'REGISTER_OTP' | 'PASSWORD_RESET_OTP' | 'PASSWORD_CHANGE_OTP' | 'WITHDRAWAL_PIN_RESET_OTP';

const OTP_COPY: Record<
  OtpTemplate,
  { subject: string; heading: string; lead: string }
> = {
  REGISTER_OTP: {
    subject: 'SmashPro - Mã xác minh đăng ký',
    heading: 'Xác minh email đăng ký',
    lead: 'Nhập mã sau để hoàn tất tạo tài khoản SmashPro.',
  },
  PASSWORD_RESET_OTP: {
    subject: 'SmashPro - Mã khôi phục mật khẩu',
    heading: 'Khôi phục mật khẩu',
    lead: 'Nhập mã sau để đặt lại mật khẩu. Nếu bạn không yêu cầu, hãy bỏ qua email này.',
  },
  PASSWORD_CHANGE_OTP: {
    subject: 'SmashPro - Mã xác minh đổi mật khẩu',
    heading: 'Xác minh đổi mật khẩu',
    lead: 'Nhập mã sau để xác nhận bạn muốn đổi mật khẩu. Nếu không phải bạn, hãy bỏ qua email này và kiểm tra bảo mật tài khoản.',
  },
  WITHDRAWAL_PIN_RESET_OTP: {
    subject: 'SmashPro - Mã đặt lại PIN rút tiền',
    heading: 'Đặt lại PIN rút tiền',
    lead: 'Nhập mã sau để thiết lập PIN rút tiền mới. Không chia sẻ mã với bất kỳ ai.',
  },
};

function wrap(heading: string, body: string): string {
  return `<!doctype html>
<html lang="vi">
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.08em;color:#0f766e">SMASHPRO</p>
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${heading}</h1>
      ${body}
      <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#6b7280">Đây là email tự động, vui lòng không trả lời.</p>
    </div>
  </body>
</html>`;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char
  );

const PARAGRAPH = 'margin:0 0 12px;font-size:15px;line-height:1.6';
const BUTTON = 'display:inline-block;margin:8px 0 16px;padding:12px 22px;background:#0f766e;border-radius:10px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none';

function renderPartnershipEmail(template: 'OWNER_REQUEST_RECEIVED' | 'OWNER_ACCOUNT_CREATED' | 'OWNER_REQUEST_REJECTED', data: EmailTemplateData): RenderedEmail {
  const name = data.contactName ?? '';
  const facility = data.facilityName ?? '';
  const greeting = `Chào ${name},`;
  if (template === 'OWNER_REQUEST_RECEIVED') {
    const lead = `SmashPro đã nhận yêu cầu hợp tác cho cơ sở "${facility}".`;
    const next = 'Đội ngũ SmashPro sẽ gọi điện cho bạn trong 1–2 ngày làm việc để xác minh thông tin. Khi tài khoản chủ sân được tạo, bạn sẽ nhận một email hướng dẫn đặt mật khẩu.';
    return {
      subject: 'SmashPro - Đã nhận yêu cầu hợp tác',
      html: wrap('Đã nhận yêu cầu hợp tác',
        `<p style="${PARAGRAPH}">${escapeHtml(greeting)}</p><p style="${PARAGRAPH}">${escapeHtml(lead)}</p><p style="${PARAGRAPH}">${next}</p>`),
      text: `${greeting}

${lead}

${next}`,
    };
  }
  if (template === 'OWNER_ACCOUNT_CREATED') {
    const account = data.accountEmail ?? '';
    const url = data.actionUrl ?? '';
    const lead = `Tài khoản chủ sân SmashPro cho cơ sở "${facility}" đã được tạo với email đăng nhập ${account}.`;
    const how = 'Bấm "Đặt mật khẩu", nhập mã xác minh được gửi tới email này và chọn mật khẩu của bạn. Sau đó bạn đăng nhập và bắt đầu thêm cơ sở, sân và bảng giá.';
    return {
      subject: 'SmashPro - Tài khoản chủ sân đã sẵn sàng',
      html: wrap('Tài khoản chủ sân đã sẵn sàng',
        `<p style="${PARAGRAPH}">${escapeHtml(greeting)}</p><p style="${PARAGRAPH}">${escapeHtml(lead)}</p>
         <p style="${PARAGRAPH}">${escapeHtml(how)}</p>
         <a href="${escapeHtml(url)}" style="${BUTTON}">Đặt mật khẩu</a>
         <p style="margin:0;font-size:13px;line-height:1.6;color:#4b5563">SmashPro không bao giờ gửi mật khẩu qua email.</p>`),
      text: `${greeting}

${lead}

${how}

Đặt mật khẩu: ${url}

SmashPro không bao giờ gửi mật khẩu qua email.`,
    };
  }
  const lead = `Cảm ơn bạn đã quan tâm. SmashPro chưa thể hợp tác với cơ sở "${facility}" lúc này.`;
  const reason = data.reason ?? '';
  const after = 'Khi thông tin thay đổi, bạn có thể gửi một yêu cầu mới tại trang Hợp tác chủ sân.';
  return {
    subject: 'SmashPro - Kết quả yêu cầu hợp tác',
    html: wrap('Kết quả yêu cầu hợp tác',
      `<p style="${PARAGRAPH}">${escapeHtml(greeting)}</p><p style="${PARAGRAPH}">${escapeHtml(lead)}</p>
       <p style="${PARAGRAPH}"><strong>Lý do:</strong> ${escapeHtml(reason)}</p><p style="${PARAGRAPH}">${after}</p>`),
    text: `${greeting}

${lead}

Lý do: ${reason}

${after}`,
  };
}

export function renderEmail(template: EmailTemplate, data: EmailTemplateData): RenderedEmail {
  if (template === 'OWNER_REQUEST_RECEIVED' || template === 'OWNER_ACCOUNT_CREATED' || template === 'OWNER_REQUEST_REJECTED') {
    return renderPartnershipEmail(template, data);
  }
  if (template === 'ADMIN_PASSWORD_RESET') {
    const by = data.adminEmail ? ` bởi ${escapeHtml(data.adminEmail)}` : '';
    const lead = `Mật khẩu tài khoản SmashPro của bạn vừa được quản trị viên đặt lại${by}.`;
    return {
      subject: 'SmashPro - Mật khẩu đã được quản trị viên đặt lại',
      html: wrap(
        'Mật khẩu đã được đặt lại',
        `<p style="margin:0;font-size:15px;line-height:1.6">${lead}</p>
         <p style="margin:12px 0 0;font-size:15px;line-height:1.6">Vui lòng liên hệ quản trị viên qua kênh đã xác minh để nhận mật khẩu tạm, sau đó đăng nhập và đổi mật khẩu ngay.</p>`
      ),
      text: `${lead}\n\nVui lòng liên hệ quản trị viên qua kênh đã xác minh để nhận mật khẩu tạm, sau đó đăng nhập và đổi mật khẩu ngay.`,
    };
  }

  const copy = OTP_COPY[template];
  const otp = escapeHtml(data.otp ?? '');
  const minutes = data.expiresInMinutes ?? 5;
  return {
    subject: copy.subject,
    html: wrap(
      copy.heading,
      `<p style="margin:0;font-size:15px;line-height:1.6">${copy.lead}</p>
       <p style="margin:20px 0;padding:14px 18px;background:#f0fdfa;border-radius:12px;font-size:30px;font-weight:700;letter-spacing:.28em;text-align:center;color:#0f766e">${otp}</p>
       <p style="margin:0;font-size:14px;line-height:1.6;color:#4b5563">Mã có hiệu lực ${minutes} phút. Không chia sẻ mã với bất kỳ ai.</p>`
    ),
    text: `${copy.heading}\n\n${copy.lead}\n\nMã: ${data.otp ?? ''}\n\nMã có hiệu lực ${minutes} phút. Không chia sẻ mã với bất kỳ ai.`,
  };
}
