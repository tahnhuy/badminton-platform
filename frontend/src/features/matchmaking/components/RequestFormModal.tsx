import { useEffect, useMemo, useState } from 'react';
import { useModalA11y } from '../../../shared/hooks/useModalA11y';
import { ApiError } from '../../../shared/api/http-client';
import { matchmakingService } from '../services/matchmakingService';
import type { CreateRequestPayload, MatchType, SkillLevel } from '../types/matchmaking';
import { errorMessage } from '../utils/status';
import {
  hasErrors,
  validateRequestForm,
  type RequestFormErrors,
  type RequestFormValues,
} from '../utils/requestFormValidation';

interface RequestFormModalProps {
  isOpen: boolean;
  skillLevels: SkillLevel[];
  defaultArea: string;
  onClose: () => void;
  onCreated: (area: string) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border-medium)',
  backgroundColor: 'var(--bg-card)',
  color: 'var(--text-primary)',
  fontSize: 14,
};

function inputStyleWithError(hasError: boolean): React.CSSProperties {
  return {
    ...inputStyle,
    borderColor: hasError ? 'var(--color-danger)' : 'var(--border-medium)',
  };
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: 6,
};

const fieldErrorStyle: React.CSSProperties = {
  display: 'block',
  marginTop: 5,
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--color-danger)',
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span role="alert" style={fieldErrorStyle}>
      {message}
    </span>
  );
}

export function RequestFormModal({ isOpen, skillLevels, defaultArea, onClose, onCreated }: RequestFormModalProps) {
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onClose);
  const initialValues = (area: string): RequestFormValues => ({
    matchType: 'SINGLES',
    preferredDate: '',
    preferredStartTime: '',
    preferredEndTime: '',
    minSkillLevelId: '',
    maxSkillLevelId: '',
    area,
  });
  const [values, setValues] = useState<RequestFormValues>(() => initialValues(defaultArea));
  const [touched, setTouched] = useState<Partial<Record<keyof RequestFormValues, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [areas, setAreas] = useState<string[]>([]);
  const [areaError, setAreaError] = useState(false);
  const [areaLoading, setAreaLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues(defaultArea));
      setTouched({});
      setSubmitting(false);
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultArea]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setAreaLoading(true);
    setAreaError(false);
    matchmakingService.listAreas().then(items => {
      if (!active) return;
      setAreas(items);
      setValues(prev => ({ ...prev, area: items.includes(prev.area) ? prev.area : '' }));
    }).catch(() => { if (active) setAreaError(true); })
      .finally(() => { if (active) setAreaLoading(false); });
    return () => { active = false; };
  }, [isOpen]);

  const errors: RequestFormErrors = useMemo(
    () => validateRequestForm(values, skillLevels),
    [values, skillLevels]
  );
  const invalid = hasErrors(errors) || areaLoading || areaError || !areas.includes(values.area);

  if (!isOpen) return null;

  const update = <K extends keyof RequestFormValues>(field: K, value: RequestFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const visibleError = (field: keyof RequestFormValues) => (touched[field] ? errors[field] : undefined);

  const submit = async () => {
    setServerError(null);
    setTouched({
      preferredDate: true,
      preferredStartTime: true,
      preferredEndTime: true,
      minSkillLevelId: true,
      maxSkillLevelId: true,
      area: true,
    });
    if (invalid) return;

    const payload: CreateRequestPayload = {
      matchType: values.matchType,
      preferredDate: values.preferredDate,
      preferredStartTime: values.preferredStartTime,
      preferredEndTime: values.preferredEndTime,
      minSkillLevelId: Number(values.minSkillLevelId),
      maxSkillLevelId: Number(values.maxSkillLevelId),
      area: values.area.trim(),
    };
    setSubmitting(true);
    try {
      await matchmakingService.createRequest(payload);
      onCreated(payload.area);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(errorMessage(err.code, err.message));
      } else {
        setServerError('Không thể tạo yêu cầu ghép trận, vui lòng thử lại.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(19, 27, 46, 0.45)',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-request-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 540,
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 16,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        <h2 id="create-request-title" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>
          Tạo yêu cầu tìm đối thủ
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle} htmlFor="mm-match-type">Loại trận</label>
            <select
              id="mm-match-type"
              value={values.matchType}
              onChange={(e) => update('matchType', e.target.value as MatchType)}
              style={inputStyle}
            >
              <option value="SINGLES">Đơn (Singles)</option>
              <option value="DOUBLES">Đôi (Doubles)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="mm-date">Ngày chơi</label>
            <input
              id="mm-date"
              type="date"
              value={values.preferredDate}
              onChange={(e) => update('preferredDate', e.target.value)}
              style={inputStyleWithError(Boolean(visibleError('preferredDate')))}
            />
            <FieldError message={visibleError('preferredDate')} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="mm-start">Giờ bắt đầu</label>
            <input
              id="mm-start"
              type="time"
              value={values.preferredStartTime}
              onChange={(e) => update('preferredStartTime', e.target.value)}
              style={inputStyleWithError(Boolean(visibleError('preferredStartTime')))}
            />
            <FieldError message={visibleError('preferredStartTime')} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="mm-end">Giờ kết thúc</label>
            <input
              id="mm-end"
              type="time"
              value={values.preferredEndTime}
              onChange={(e) => update('preferredEndTime', e.target.value)}
              style={inputStyleWithError(Boolean(visibleError('preferredEndTime')))}
            />
            <FieldError message={visibleError('preferredEndTime')} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="mm-min-skill">Trình độ tối thiểu</label>
            <select
              id="mm-min-skill"
              value={values.minSkillLevelId}
              onChange={(e) => update('minSkillLevelId', e.target.value === '' ? '' : Number(e.target.value))}
              style={inputStyleWithError(Boolean(visibleError('minSkillLevelId')))}
            >
              <option value="">Chọn</option>
              {skillLevels.map((level) => (
                <option key={level.code} value={level.id}>{level.name}</option>
              ))}
            </select>
            <FieldError message={visibleError('minSkillLevelId')} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="mm-max-skill">Trình độ tối đa</label>
            <select
              id="mm-max-skill"
              value={values.maxSkillLevelId}
              onChange={(e) => update('maxSkillLevelId', e.target.value === '' ? '' : Number(e.target.value))}
              style={inputStyleWithError(Boolean(visibleError('maxSkillLevelId')))}
            >
              <option value="">Chọn</option>
              {skillLevels.map((level) => (
                <option key={level.code} value={level.id}>{level.name}</option>
              ))}
            </select>
            <FieldError message={visibleError('maxSkillLevelId')} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle} htmlFor="mm-area">Khu vực</label>
            <select id="mm-area" value={values.area} disabled={areaLoading || areaError}
              onChange={e => update('area', e.target.value)} style={inputStyleWithError(Boolean(visibleError('area')))}>
              <option value="">{areaLoading ? 'Đang tải khu vực...' : 'Chọn thành phố / quận'}</option>
              {areas.map(area => <option key={area} value={area}>{area}</option>)}
            </select>
            {areaError && <FieldError message="Không thể tải khu vực. Đóng và mở lại để thử lại." />}
            {!areaLoading && !areaError && areas.length === 0 && <FieldError message="Chưa có khu vực có sân khả dụng." />}
            <FieldError message={visibleError('area')} />
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Hệ thống sẽ kiểm tra thời lượng và thời gian chuẩn bị theo cấu hình hiện tại khi tạo yêu cầu.
        </p>

        {serverError && <span role="alert" style={{ fontSize: 13, color: 'var(--color-danger)' }}>{serverError}</span>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{ padding: '10px 18px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || (invalid && Object.values(touched).some(Boolean))}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              backgroundColor: invalid ? 'var(--color-border, #BDCABA)' : 'var(--color-brand)',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: 13,
              cursor: submitting ? 'default' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Đang tạo...' : 'Tạo yêu cầu'}
          </button>
        </div>
      </div>
    </div>
  );
}
