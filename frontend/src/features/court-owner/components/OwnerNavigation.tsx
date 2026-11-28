import { NavLink } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';
import { OWNER_NAV_LINKS } from './owner-nav-links';

export function OwnerNavigation({ query, mobile = false }: { query: string; mobile?: boolean }) {
  return <nav aria-label="Kênh Chủ sân" className={mobile ? 'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden' : 'hidden min-w-0 flex-1 lg:block'}>
    <ul className={mobile ? 'mx-auto grid h-16 max-w-xl grid-cols-5' : 'flex items-center justify-center gap-1'}>{OWNER_NAV_LINKS.map(({ path, label, short, icon: Icon }) => <li key={path} className="flex min-w-0"><NavLink end to={`/owner${path}${query}`} aria-label={label} className={({ isActive }) => cn(
      'flex min-h-11 flex-1 items-center justify-center rounded-lg font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
      mobile ? 'flex-col gap-1 py-2 text-xs' : 'gap-2 whitespace-nowrap px-2 py-2 text-sm 2xl:px-3', isActive ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    )}><Icon aria-hidden="true" className={mobile ? 'size-5' : 'size-4'} />{mobile ? <span>{short}</span> : <><span className="2xl:hidden">{short}</span><span className="hidden 2xl:inline">{label}</span></>}</NavLink></li>)}</ul>
  </nav>;
}
