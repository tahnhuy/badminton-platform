export function formatDate(dateStr?: string | null): string {
  if (!dateStr) {
    return '—';
  }

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
