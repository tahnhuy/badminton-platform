import { Building2, CalendarDays, CircleDollarSign, CircleUserRound, LayoutDashboard, Wallet } from 'lucide-react';

export const OWNER_NAV_LINKS = [
  { path: '', label: 'Bảng điều khiển', short: 'Tổng quan', icon: LayoutDashboard },
  { path: '/facilities', label: 'Quản lý cơ sở', short: 'Cơ sở', icon: Building2 },
  { path: '/pricing', label: 'Bảng giá sân', short: 'Giá sân', icon: CircleDollarSign },
  { path: '/schedule', label: 'Lịch đặt & Giám sát', short: 'Lịch đặt', icon: CalendarDays },
  { path: '/wallet', label: 'Ví & thu nhập', short: 'Ví', icon: Wallet },
  { path: '/account', label: 'Tài khoản', short: 'Tài khoản', icon: CircleUserRound },
];
