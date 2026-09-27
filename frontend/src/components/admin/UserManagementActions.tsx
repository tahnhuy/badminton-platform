import React, { useState } from 'react';
import type { UserStatus } from '../../types/user';
import {
  ExportIcon,
  BulkActionIcon,
  ChevronDownIcon,
  CheckShieldIcon,
  TrashIcon,
  PlusIcon,
} from '../common/Icons';

interface UserManagementActionsProps {
  selectedCount: number;
  onExport: () => void;
  onBulkStatus: (status: UserStatus) => void;
  onBulkDelete: () => void;
  onAddUser: () => void;
}

export const UserManagementActions: React.FC<UserManagementActionsProps> = ({
  selectedCount,
  onExport,
  onBulkStatus,
  onBulkDelete,
  onAddUser,
}) => {
  const [isBulkMenuOpen, setIsBulkMenuOpen] = useState(false);
  const hasSelection = selectedCount > 0;

  const bulkButtonColor = hasSelection ? 'var(--color-brand-blue)' : 'var(--bg-tag-blue)';
  const bulkButtonTextColor = hasSelection ? '#FFFFFF' : 'var(--text-primary)';

  const closeBulkMenu = () => setIsBulkMenuOpen(false);

  const bulkMenuItems: Array<{ label: string; status: UserStatus; color: string; icon?: React.ReactNode }> = [
    { label: 'Kích hoạt (ACTIVE)', status: 'ACTIVE', color: 'var(--color-brand)', icon: <CheckShieldIcon size={15} color="var(--color-brand)" /> },
    { label: 'Tạm đình chỉ (SUSPENDED)', status: 'SUSPENDED', color: 'var(--color-danger)' },
    { label: 'Vô hiệu hóa (DEACTIVATED)', status: 'DEACTIVATED', color: 'var(--text-secondary)' },
  ];

  return (
    <div className="page-header-actions" style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onExport}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          backgroundColor: '#FFFFFF',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid rgba(189, 202, 186, 0.4)',
          cursor: 'pointer',
        }}
      >
        <ExportIcon size={16} color="var(--color-brand)" />
        <span>Xuất Excel (.xls)</span>
      </button>

      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setIsBulkMenuOpen((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            backgroundColor: bulkButtonColor,
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            color: bulkButtonTextColor,
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
          }}
        >
          <BulkActionIcon size={16} color={bulkButtonTextColor} />
          <span>Tác vụ hàng loạt {hasSelection ? `(${selectedCount})` : ''}</span>
          <ChevronDownIcon size={12} color={bulkButtonTextColor} />
        </button>

        {isBulkMenuOpen && (
          <>
            <div onClick={closeBulkMenu} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 6,
                width: 230,
                backgroundColor: '#FFFFFF',
                borderRadius: 10,
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid rgba(189, 202, 186, 0.4)',
                padding: '6px 0',
                zIndex: 70,
              }}
            >
              <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                ĐANG CHỌN {selectedCount} TÀI KHOẢN
              </div>

              {bulkMenuItems.map((item) => (
                <button
                  key={item.status}
                  type="button"
                  onClick={() => {
                    closeBulkMenu();
                    onBulkStatus(item.status);
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 16px',
                    fontSize: 13,
                    color: item.color,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    textAlign: 'left',
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}

              <div style={{ height: 1, backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />

              <button
                type="button"
                onClick={() => {
                  closeBulkMenu();
                  onBulkDelete();
                }}
                style={{
                  width: '100%',
                  padding: '9px 16px',
                  fontSize: 13,
                  color: 'var(--color-danger)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                }}
              >
                <TrashIcon size={14} color="var(--color-danger)" />
                <span>Xóa mềm hàng loạt</span>
              </button>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onAddUser}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          backgroundColor: 'var(--color-brand)',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          color: '#FFFFFF',
          boxShadow: 'var(--shadow-md)',
          cursor: 'pointer',
        }}
      >
        <PlusIcon size={16} color="#FFFFFF" />
        <span>Thêm người dùng</span>
      </button>
    </div>
  );
};
