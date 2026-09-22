import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { AdminPlaceholderPage } from './pages/admin/AdminPlaceholderPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/users" element={<UserManagementPage />} />
        <Route
          path="/admin/dashboard"
          element={
            <AdminPlaceholderPage
              title="Bảng điều khiển"
              description="Tổng quan số liệu thống kê vận hành, doanh thu và các chỉ số toàn hệ thống."
            />
          }
        />
        <Route
          path="/admin/courts"
          element={
            <AdminPlaceholderPage
              title="Quản lý cơ sở & sân"
              description="Quản lý danh sách câu lạc bộ, cụm sân cầu lông, phê duyệt cơ sở và bảng giá."
            />
          }
        />
        <Route
          path="/admin/tournaments"
          element={
            <AdminPlaceholderPage
              title="Quản lý giải đấu"
              description="Giám sát các giải đấu phong trào, chuyên nghiệp, bảng đấu và trọng tài."
            />
          }
        />
        <Route
          path="/admin/reports"
          element={
            <AdminPlaceholderPage
              title="Quản lý báo cáo & khiếu nại"
              description="Tiếp nhận và xử lý các báo cáo vi phạm FairPlay, khiếu nại trận đấu và sân bãi."
            />
          }
        />
        <Route path="*" element={<Navigate to="/admin/users" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
