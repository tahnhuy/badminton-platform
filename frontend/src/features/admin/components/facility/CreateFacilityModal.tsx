import React, { useState } from 'react';
import { CloseIcon } from '../../../../components/common/Icons';
import { useModalA11y } from '../../../../shared/hooks/useModalA11y';

export interface CreateFacilityFormData {
  name: string;
  address: string;
  city: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  courtCount: number;
}

interface CreateFacilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateFacilityFormData) => Promise<void>;
}

export const CreateFacilityModal: React.FC<CreateFacilityModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onClose);

  const [formData, setFormData] = useState<CreateFacilityFormData>({
    name: '',
    address: '',
    city: 'Hồ Chí Minh',
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
    courtCount: 4,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      nextErrors.name = 'Vui lòng nhập tên cơ sở';
    } else if (formData.name.trim().length < 2) {
      nextErrors.name = 'Tên cơ sở tối thiểu 2 ký tự';
    }

    if (!formData.address.trim()) {
      nextErrors.address = 'Vui lòng nhập địa chỉ chi tiết';
    } else if (formData.address.trim().length < 5) {
      nextErrors.address = 'Địa chỉ chi tiết tối thiểu 5 ký tự';
    }

    if (!formData.ownerName.trim()) {
      nextErrors.ownerName = 'Vui lòng nhập họ tên chủ sân';
    } else if (formData.ownerName.trim().length < 2) {
      nextErrors.ownerName = 'Họ tên chủ sân tối thiểu 2 ký tự';
    }

    if (!formData.ownerPhone.trim()) {
      nextErrors.ownerPhone = 'Vui lòng nhập số điện thoại';
    } else if (formData.ownerPhone.trim().length < 8) {
      nextErrors.ownerPhone = 'Số điện thoại tối thiểu 8 chữ số';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.ownerEmail.trim()) {
      nextErrors.ownerEmail = 'Vui lòng nhập email chủ sân';
    } else if (!emailRegex.test(formData.ownerEmail.trim())) {
      nextErrors.ownerEmail = 'Email chủ sân không đúng định dạng';
    }

    if (!formData.courtCount || formData.courtCount < 1) {
      nextErrors.courtCount = 'Số sân tối thiểu là 1';
    } else if (formData.courtCount > 50) {
      nextErrors.courtCount = 'Số sân tối đa là 50';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      await onSubmit(formData);
      onClose();
      // Reset
      setFormData({
        name: '',
        address: '',
        city: 'Hồ Chí Minh',
        ownerName: '',
        ownerPhone: '',
        ownerEmail: '',
        courtCount: 4,
      });
      setErrors({});
    } catch (err: any) {
      const fieldErrors: Record<string, string> = {};
      if (err.details && Array.isArray(err.details)) {
        err.details.forEach((item: any) => {
          if (item.field) {
            fieldErrors[item.field] = item.message;
          }
        });
      }
      setErrors({
        ...fieldErrors,
        form: err.message || 'Lỗi khi tạo cơ sở mới',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(19, 27, 46, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
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
          boxShadow: 'var(--shadow-modal)',
          maxWidth: 640,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(189, 202, 186, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-table-header)',
          }}
        >
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Thêm cơ sở &amp; Cụm sân thi đấu mới
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Khởi tạo hồ sơ cơ sở đối tác và cấu hình số lượng sân đạt chuẩn BWF
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: 6,
              borderRadius: 8,
              color: 'var(--text-secondary)',
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(189, 202, 186, 0.4)',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {errors.form && (
              <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: '#FFDAD6', color: '#93000A', fontSize: 13, fontWeight: 600 }}>
                {errors.form}
              </div>
            )}

            {/* Section 1: Facility Basics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                1. THÔNG TIN CƠ SỞ
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Tên cụm sân / cơ sở <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: CLB Cầu Lông SmashPro Star Tân Bình"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: `1px solid ${errors.name ? 'var(--color-danger)' : 'rgba(189, 202, 186, 0.6)'}`,
                    fontSize: 13,
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                {errors.name && <span style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 2, display: 'block' }}>{errors.name}</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Tỉnh / Thành phố <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 10px',
                      borderRadius: 8,
                      border: '1px solid rgba(189, 202, 186, 0.6)',
                      fontSize: 13,
                      boxSizing: 'border-box',
                      backgroundColor: '#FFFFFF',
                      outline: 'none',
                    }}
                  >
                    <option value="Hồ Chí Minh">TP. Hồ Chí Minh</option>
                    <option value="Hà Nội">Hà Nội</option>
                    <option value="Đà Nẵng">Đà Nẵng</option>
                    <option value="Bình Dương">Bình Dương</option>
                    <option value="Cần Thơ">Cần Thơ</option>
                    <option value="Hải Phòng">Hải Phòng</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Địa chỉ chi tiết <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Số nhà, tên đường, Phường/Xã, Quận/Huyện"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: `1px solid ${errors.address ? 'var(--color-danger)' : 'rgba(189, 202, 186, 0.6)'}`,
                      fontSize: 13,
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                  {errors.address && <span style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 2, display: 'block' }}>{errors.address}</span>}
                </div>
              </div>
            </div>

            {/* Section 2: Owner Contact */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid #EEF0F4', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                2. CHỦ SỞ HỮU &amp; ĐẠI DIỆN
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Họ &amp; Tên chủ sân <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Nguyễn Văn A"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: `1px solid ${errors.ownerName ? 'var(--color-danger)' : 'rgba(189, 202, 186, 0.6)'}`,
                      fontSize: 13,
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                  {errors.ownerName && <span style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 2, display: 'block' }}>{errors.ownerName}</span>}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Số điện thoại <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="0901234567"
                    value={formData.ownerPhone}
                    onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                    style={{
                      width: '100%',
                      height: 38,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: `1px solid ${errors.ownerPhone ? 'var(--color-danger)' : 'rgba(189, 202, 186, 0.6)'}`,
                      fontSize: 13,
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                  {errors.ownerPhone && <span style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 2, display: 'block' }}>{errors.ownerPhone}</span>}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Email đăng ký quản lý <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="email"
                  placeholder="owner@badminton.com"
                  value={formData.ownerEmail}
                  onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: `1px solid ${errors.ownerEmail ? 'var(--color-danger)' : 'rgba(189, 202, 186, 0.6)'}`,
                    fontSize: 13,
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                {errors.ownerEmail && <span style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 2, display: 'block' }}>{errors.ownerEmail}</span>}
              </div>
            </div>

            {/* Section 3: Court Scale */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid #EEF0F4', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                3. QUY MÔ SÂN
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Số lượng sân
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={formData.courtCount}
                  onChange={(e) => setFormData({ ...formData, courtCount: Number(e.target.value) || 1 })}
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: `1px solid ${errors.courtCount ? 'var(--color-danger)' : 'rgba(189, 202, 186, 0.6)'}`,
                    fontSize: 13,
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                {errors.courtCount && <span style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 2, display: 'block' }}>{errors.courtCount}</span>}
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(189, 202, 186, 0.3)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              backgroundColor: 'var(--bg-table-header)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                backgroundColor: '#FFFFFF',
                color: 'var(--text-primary)',
                border: '1px solid rgba(189, 202, 186, 0.5)',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '8px 20px',
                backgroundColor: 'var(--color-brand)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? 'Đang tạo...' : 'Tạo cơ sở'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
