import React from 'react';
import { CloseIcon } from '../../../components/common/Icons';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onRemove }) => {
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      zIndex: 100,
      maxWidth: 380,
      width: '100%'
    }}>
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        return (
          <div
            key={toast.id}
            className="animate-fade-in"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 8,
              padding: '12px 16px',
              boxShadow: 'var(--shadow-lg)',
              borderLeft: `4px solid ${isSuccess ? 'var(--color-brand)' : isError ? 'var(--color-danger)' : 'var(--color-brand-blue)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {toast.message}
            </div>
            <button
              onClick={() => onRemove(toast.id)}
              style={{
                color: 'var(--text-secondary)',
                display: 'flex',
                padding: 4
              }}
            >
              <CloseIcon size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
