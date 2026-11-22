import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { BrandLogo } from '@/components/common/brand-logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OwnerNavigation } from './OwnerNavigation';

export function OwnerHeader({ query, email, signOut }: { query: string; email?: string; signOut: () => Promise<void> }) {
  return <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
    <div className="mx-auto flex min-h-20 max-w-360 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 xl:flex-nowrap">
      <Link to="/owner" className="inline-flex shrink-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"><BrandLogo size="sm" compactOnMobile /><Badge variant="success">Chủ sân</Badge></Link>
      <OwnerNavigation query={query} />
      <div className="flex min-w-0 items-center gap-3"><span className="hidden max-w-44 truncate text-xs text-muted-foreground 2xl:block" title={email}>{email}</span><Button type="button" variant="outline" className="h-11" onClick={() => void signOut()}><LogOut aria-hidden="true" />Đăng xuất</Button></div>
    </div>
  </header>;
}
