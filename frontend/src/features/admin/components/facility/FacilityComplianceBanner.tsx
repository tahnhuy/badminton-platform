import { Alert } from '@/components/ui/alert';
export function FacilityComplianceBanner() {
  return <Alert role="note">
    <h2 className="mb-2 font-bold">Đình chỉ và vô hiệu hóa cơ sở</h2>
    <p>Đình chỉ (SUSPENDED) ngăn đặt sân mới, giữ nguyên booking đã xác nhận và trạng thái riêng của các sân. Kích hoạt cơ sở không tự duyệt sân đang chờ hoặc bị từ chối. Vô hiệu hóa cơ sở đồng thời vô hiệu hóa các sân trực thuộc và không thể khôi phục trong luồng MVP.</p>
  </Alert>;
}
