import type { UserStatus } from '../types/user';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/shared/utils/cn';
export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <Badge className={cn(status === 'ACTIVE' && 'bg-success-bg text-success', status === 'SUSPENDED' && 'bg-danger-bg text-destructive')}>{status === 'ACTIVE' ? 'Hoạt động' : status === 'SUSPENDED' ? 'Đình chỉ (Vi phạm)' : 'Đã vô hiệu hóa'}</Badge>;
}
