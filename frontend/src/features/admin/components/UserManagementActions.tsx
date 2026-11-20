import { useState } from 'react';
import { Download, ListChecks, Plus, ChevronDown, Trash2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import type { UserStatus } from '../types/user';
interface UserManagementActionsProps { selectedCount: number; onExport: () => void; onBulkStatus: (status: UserStatus) => void; onBulkDelete: () => void; onAddUser: () => void }
export function UserManagementActions({ selectedCount, onExport, onBulkStatus, onBulkDelete, onAddUser }: UserManagementActionsProps) {
  const [isBulkMenuOpen, setIsBulkMenuOpen] = useState(false);
  const hasSelection = selectedCount > 0;
  const closeBulkMenu = () => setIsBulkMenuOpen(false);
  const bulkMenuItems: { label: string; status: UserStatus }[] = [
    { label: 'Kích hoạt (ACTIVE)', status: 'ACTIVE' }, { label: 'Tạm đình chỉ (SUSPENDED)', status: 'SUSPENDED' }, { label: 'Vô hiệu hóa (DEACTIVATED)', status: 'DEACTIVATED' },
  ];
  return <div className="flex flex-wrap gap-2">
    <Button variant="outline" onClick={onExport}>
      <Download aria-hidden="true" />Xuất Excel (.xls)</Button>
    <DropdownMenu open={isBulkMenuOpen} onOpenChange={setIsBulkMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant={hasSelection ? 'brand' : 'outline'}>
          <ListChecks aria-hidden="true" />Tác vụ hàng loạt {hasSelection ? `(${selectedCount})` : ''}<ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>ĐANG CHỌN {selectedCount} TÀI KHOẢN</DropdownMenuLabel>{bulkMenuItems.map(item => <DropdownMenuItem key={item.status} onSelect={() => { closeBulkMenu(); onBulkStatus(item.status); }}>
          <ShieldCheck aria-hidden="true" />{item.label}</DropdownMenuItem>)}<DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => { closeBulkMenu(); onBulkDelete(); }}>
          <Trash2 aria-hidden="true" />Xóa mềm hàng loạt</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Button onClick={onAddUser}>
      <Plus aria-hidden="true" />Thêm người dùng</Button>
  </div>;
}
