import { AdminDialog, AdminDialogFooter } from '../AdminDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import React, { useState } from 'react';

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

  return <AdminDialog open={isOpen} onClose={onClose} title="Thêm cơ sở & Cụm sân thi đấu mới" description="Khởi tạo hồ sơ cơ sở đối tác và cấu hình số lượng sân.">
    <form onSubmit={handleSubmit} className="space-y-5">{errors.form && <Alert variant="destructive">{errors.form}</Alert>}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-bold">1. THÔNG TIN CƠ SỞ</legend>
        <label className="space-y-2 text-sm font-semibold sm:col-span-2">Tên cụm sân / cơ sở *<Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="VD: CLB Cầu Lông SmashPro Star Tân Bình" aria-invalid={!!errors.name} />{errors.name && <span className="text-destructive">{errors.name}</span>}</label>
        <label className="space-y-2 text-sm font-semibold">Tỉnh / Thành phố *<Select value={formData.city} onChange={value => setFormData({ ...formData, city: value })} options={['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Bình Dương', 'Cần Thơ', 'Hải Phòng'].map(city => ({ value: city, label: city === 'Hồ Chí Minh' ? 'TP. Hồ Chí Minh' : city }))} />
        </label>
        <label className="space-y-2 text-sm font-semibold">Địa chỉ chi tiết *<Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Số nhà, tên đường, Phường/Xã, Quận/Huyện" aria-invalid={!!errors.address} />{errors.address && <span className="text-destructive">{errors.address}</span>}</label>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-bold">2. CHỦ SỞ HỮU & ĐẠI DIỆN</legend>
        <label className="space-y-2 text-sm font-semibold">Họ & Tên chủ sân *<Input value={formData.ownerName} onChange={e => setFormData({ ...formData, ownerName: e.target.value })} placeholder="VD: Nguyễn Văn A" aria-invalid={!!errors.ownerName} />{errors.ownerName && <span className="text-destructive">{errors.ownerName}</span>}</label>
        <label className="space-y-2 text-sm font-semibold">Số điện thoại *<Input type="text" value={formData.ownerPhone} onChange={e => setFormData({ ...formData, ownerPhone: e.target.value })} placeholder="0901234567" aria-invalid={!!errors.ownerPhone} />{errors.ownerPhone && <span className="text-destructive">{errors.ownerPhone}</span>}</label>
        <label className="space-y-2 text-sm font-semibold sm:col-span-2">Email đăng ký quản lý *<Input type="email" value={formData.ownerEmail} onChange={e => setFormData({ ...formData, ownerEmail: e.target.value })} placeholder="owner@badminton.com" aria-invalid={!!errors.ownerEmail} />{errors.ownerEmail && <span className="text-destructive">{errors.ownerEmail}</span>}</label>
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-sm font-bold">3. QUY MÔ SÂN</legend>
        <label className="block space-y-2 text-sm font-semibold">Số lượng sân<Input type="number" min={1} max={50} value={formData.courtCount} onChange={e => setFormData({ ...formData, courtCount: Number(e.target.value) || 1 })} aria-invalid={!!errors.courtCount} />{errors.courtCount && <span className="text-destructive">{errors.courtCount}</span>}</label>
      </fieldset>
      <AdminDialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Hủy</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang tạo...' : 'Tạo cơ sở'}</Button>
      </AdminDialogFooter>
    </form>
  </AdminDialog>;
};
