import React, { useState } from 'react';
import type { UserRole, UserStatus, CreateUserPayload } from '../types/user';
import { CloseIcon, PlusIcon } from '../../../components/common/Icons';
import { useModalA11y } from '../../../shared/hooks/useModalA11y';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newUser: any) => void;
  onSubmit: (payload: CreateUserPayload) => Promise<void>;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('PLAYER');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [skillLevelId, setSkillLevelId] = useState<number>(2); // Default Intermediate
  const [avatarUrl, setAvatarUrl] = useState('/images/avatar_player1-56586a.png');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onClose);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Vui lòng nhập email hợp lệ.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự.');
      return;
    }

    if (role === 'PLAYER' && !fullName.trim()) {
      setError('Vui lòng nhập họ và tên VĐV.');
      return;
    }

    if (role === 'COURT_OWNER') {
      if (!businessName.trim()) {
        setError('Vui lòng nhập tên sân / câu lạc bộ.');
        return;
      }
      if (!phone.trim()) {
        setError('Vui lòng nhập số điện thoại liên hệ.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        email: email.trim().toLowerCase(),
        password,
        role,
        status,
        fullName: role === 'PLAYER' ? fullName.trim() : undefined,
        skillLevelId: role === 'PLAYER' ? skillLevelId : undefined,
        avatarUrl: role === 'PLAYER' ? avatarUrl : undefined,
        businessName: role === 'COURT_OWNER' ? businessName.trim() : undefined,
        phone: role === 'COURT_OWNER' ? phone.trim() : undefined,
      });
      // Reset form
      setEmail('');
      setPassword('');
      setFullName('');
      setBusinessName('');
      setPhone('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo người dùng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(19, 27, 46, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="animate-fade-in"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          width: '100%',
          maxWidth: 540,
          boxShadow: 'var(--shadow-modal)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          outline: 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-table-header)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: 'var(--color-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
              }}
            >
              <PlusIcon size={18} color="#FFFFFF" />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Thêm người dùng mới
              </h2>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Tạo tài khoản VĐV, Chủ sân hoặc Quản trị viên
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: 6,
              borderRadius: 6,
              color: 'var(--text-secondary)',
              display: 'flex',
            }}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  backgroundColor: 'var(--color-danger-bg)',
                  border: '1px solid rgba(186, 26, 26, 0.2)',
                  color: 'var(--color-danger)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {error}
              </div>
            )}

            {/* Role Selection */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Vai trò hệ thống <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { id: 'PLAYER', label: 'VĐV (Player)' },
                  { id: 'COURT_OWNER', label: 'Chủ sân (Owner)' },
                  { id: 'ADMIN', label: 'Quản trị viên' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRole(item.id as UserRole)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      border: role === item.id ? '2px solid var(--color-brand)' : '1px solid var(--border-medium)',
                      backgroundColor: role === item.id ? 'var(--bg-tag-green)' : '#FFFFFF',
                      color: role === item.id ? 'var(--color-brand)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Email & Password */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Email đăng nhập <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vd: athlete@example.com"
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-medium)',
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Mật khẩu khởi tạo <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-medium)',
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            {/* Conditional Role Details */}
            {role === 'PLAYER' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                      Họ và tên VĐV <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="vd: Nguyễn Văn Nam"
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-medium)',
                        fontSize: 13,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                      Trình độ kỹ năng
                    </label>
                    <select
                      value={skillLevelId}
                      onChange={(e) => setSkillLevelId(Number(e.target.value))}
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-medium)',
                        fontSize: 13,
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <option value={1}>Mới chơi (Beginner)</option>
                      <option value={2}>Trung bình (Intermediate)</option>
                      <option value={3}>Khá / Bán chuyên (Advanced)</option>
                      <option value={4}>Chuyên nghiệp (PRO)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Chọn Avatar mẫu
                  </label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {[
                      '/images/avatar_player1-56586a.png',
                      '/images/avatar_player2-4a0be7.png',
                      '/images/avatar_player3-7ca715.png',
                      '/images/avatar_owner1-56586a.png',
                    ].map((imgUrl, idx) => (
                      <img
                        key={idx}
                        src={imgUrl}
                        alt="Avatar"
                        onClick={() => setAvatarUrl(imgUrl)}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          cursor: 'pointer',
                          border: avatarUrl === imgUrl ? '3px solid var(--color-brand)' : '1px solid transparent',
                          padding: 1,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {role === 'COURT_OWNER' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Tên Sân / CLB <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="vd: CLB Cầu Lông Tân Bình"
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-medium)',
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Số điện thoại <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="vd: 0901234567"
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-medium)',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Initial Status */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Trạng thái tài khoản ban đầu
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-medium)',
                  fontSize: 13,
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                <option value="SUSPENDED">Tạm đình chỉ (SUSPENDED)</option>
                <option value="DEACTIVATED">Vô hiệu hóa (DEACTIVATED)</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 12,
              backgroundColor: 'var(--bg-table-header)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-medium)',
              }}
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                color: '#FFFFFF',
                backgroundColor: 'var(--color-brand)',
                boxShadow: 'var(--shadow-sm)',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? 'Đang tạo...' : '+ Tạo người dùng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
