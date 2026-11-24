export const EMAIL_TEMPLATES = [
  'REGISTER_OTP',
  'PASSWORD_RESET_OTP',
  'PASSWORD_CHANGE_OTP',
  'WITHDRAWAL_PIN_RESET_OTP',
  'ADMIN_PASSWORD_RESET',
] as const;

export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export interface EmailTemplateData {
  otp?: string;
  expiresInMinutes?: number;
  /** Only used by the Admin reset notification; the temporary password is never emailed. */
  adminEmail?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const OTP_COPY: Record<
  Exclude<EmailTemplate, 'ADMIN_PASSWORD_RESET'>,
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

export function renderEmail(template: EmailTemplate, data: EmailTemplateData): RenderedEmail {
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
