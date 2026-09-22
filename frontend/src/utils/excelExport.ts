import type { User, PlayerProfile, CourtOwnerProfile } from '../types/user';
import { formatDate } from './formatDate';

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function exportUsersToExcel(users: User[], filename = 'danh-sach-nguoi-dung-smashpro.xls'): void {
  const getDisplayName = (user: User) => {
    if (user.role === 'PLAYER' && user.profile && 'fullName' in user.profile) {
      return (user.profile as PlayerProfile).fullName;
    }
    if (user.role === 'COURT_OWNER' && user.profile && 'businessName' in user.profile) {
      return (user.profile as CourtOwnerProfile).businessName;
    }
    return user.email.split('@')[0];
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'PLAYER':
        return 'VĐV (Player)';
      case 'COURT_OWNER':
        return 'Chủ sân (Court Owner)';
      case 'ADMIN':
        return 'Quản trị viên (Admin)';
      default:
        return role;
    }
  };

  const getPhone = (user: User) => {
    if (user.role === 'COURT_OWNER' && user.profile && 'phone' in user.profile) {
      return (user.profile as CourtOwnerProfile).phone;
    }
    return '';
  };

  // Build HTML Table Spreadsheet for Excel (native UTF-8 XML/HTML standard)
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
      <style>
        table { border-collapse: collapse; width: 100%; font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 13px; }
        th { background-color: #006B2C; color: #FFFFFF; font-weight: bold; padding: 10px 14px; border: 1px solid #DDDDDD; text-align: left; }
        td { padding: 8px 12px; border: 1px solid #DDDDDD; }
        .center { text-align: center; }
        .uid { font-family: monospace; font-weight: bold; }
        .active { color: #006B2C; font-weight: bold; }
        .suspended { color: #BA1A1A; font-weight: bold; }
        .deactivated { color: #767676; }
      </style>
    </head>
    <body>
      <h2>BÁO CÁO DANH SÁCH NGƯỜI DÙNG - BADMINTON SMASHPRO</h2>
      <p>Ngày xuất dữ liệu: ${new Date().toLocaleString('vi-VN')}</p>
      <table>
        <thead>
          <tr>
            <th>STT</th>
            <th>MÃ ĐỊNH DANH (UID)</th>
            <th>HỌ VÀ TÊN / CƠ SỞ</th>
            <th>EMAIL</th>
            <th>SỐ ĐIỆN THOẠI</th>
            <th>VAI TRÒ</th>
            <th>TRẠNG THÁI</th>
            <th>NGÀY GIA NHẬP</th>
          </tr>
        </thead>
        <tbody>
  `;

  users.forEach((u, index) => {
    const statusClass = u.status === 'ACTIVE' ? 'active' : u.status === 'SUSPENDED' ? 'suspended' : 'deactivated';
    html += `
      <tr>
        <td class="center">${index + 1}</td>
        <td class="uid">#UID-${escapeHtml(u.id + 10000)}</td>
        <td><strong>${escapeHtml(getDisplayName(u))}</strong></td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(getPhone(u))}</td>
        <td>${escapeHtml(getRoleLabel(u.role))}</td>
        <td class="${statusClass}">${escapeHtml(u.status)}</td>
        <td>${escapeHtml(formatDate(u.createdAt))}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
