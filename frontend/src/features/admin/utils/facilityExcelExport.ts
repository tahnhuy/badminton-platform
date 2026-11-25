import type { Facility } from '../types/facility';
import { formatDate } from '../../../shared/utils/formatDate';

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function exportFacilitiesToExcel(facilities: Facility[], filename = 'danh-sach-co-so-smashpro.xls'): void {
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
      </style>
    </head>
    <body>
      <h2>BÁO CÁO DANH SÁCH CƠ SỞ & CỤM SÂN - BADMINTON SMASHPRO</h2>
      <p>Thời gian xuất: ${new Date().toLocaleString('vi-VN')}</p>
      <p>Tổng số cơ sở: ${facilities.length}</p>
      <table>
        <thead>
          <tr>
            <th>Mã Cơ Sở</th>
            <th>Tên Cơ Sở / Cụm Sân</th>
            <th>Địa Chỉ</th>
            <th>Tỉnh / Thành Phố</th>
            <th>Chủ Sở Hữu</th>
            <th>Số Điện Thoại</th>
            <th>Email</th>
            <th>Tổng Sân</th>
            <th>Sân Đang Hoạt Động</th>
            <th>Nguồn Dữ Liệu</th>
            <th>Đã Xác Nhận</th>
            <th>Trạng Thái</th>
            <th>Ngày Tạo</th>
          </tr>
        </thead>
        <tbody>
  `;

  facilities.forEach((f) => {
    const statusClass = f.status === 'ACTIVE' ? 'active' : 'suspended';
    const statusLabel = f.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm đình chỉ';

    html += `
      <tr>
        <td class="uid">${escapeHtml(f.facilityCode)}</td>
        <td><b>${escapeHtml(f.name)}</b></td>
        <td>${escapeHtml(f.address)}</td>
        <td>${escapeHtml(f.city)}</td>
        <td>${escapeHtml(f.owner.name)}</td>
        <td>${escapeHtml(f.owner.phone)}</td>
        <td>${escapeHtml(f.owner.email)}</td>
        <td class="center">${f.courtStats.totalCourts} sân</td>
        <td class="center">${f.courtStats.activeCourts} sân</td>
        <td>${escapeHtml(f.dataSource || 'Chưa xác định')}</td>
        <td>${f.confirmedAt ? formatDate(f.confirmedAt) : 'Chưa xác nhận'}</td>
        <td class="${statusClass}">${statusLabel}</td>
        <td>${formatDate(f.createdAt)}</td>
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
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
