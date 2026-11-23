import { Link } from 'react-router-dom';
import { BrandLogo } from './brand-logo';

export interface SiteFooterLink {
  to: string;
  label: string;
}

interface SiteFooterProps {
  homePath: string;
  tagline: string;
  links: SiteFooterLink[];
  linksLabel: string;
  roleLabel: string;
}

/** Shared app footer: brand, role areas that already have working pages, and the copyright line. */
export function SiteFooter({ homePath, tagline, links, linksLabel, roleLabel }: SiteFooterProps) {
  return <footer className="mt-auto border-t border-border bg-card">
    <div className="mx-auto flex w-full max-w-360 flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-sm">
        <Link to={homePath} className="inline-flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandLogo size="sm" />
        </Link>
        <p className="mt-3 text-xs leading-6 text-muted-foreground">{tagline}</p>
      </div>
      <nav aria-label={linksLabel} className="lg:max-w-xl">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 sm:flex sm:flex-wrap sm:justify-start sm:gap-x-8">
          {links.map(link => <li key={link.to} className="min-w-0">
            <Link to={link.to} className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring">
              {link.label}
            </Link>
          </li>)}
        </ul>
      </nav>
    </div>
    <div className="border-t border-border">
      <div className="mx-auto flex w-full max-w-360 flex-col gap-1 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} SmashPro. Mọi quyền được bảo lưu.</p>
        <p>{roleLabel}</p>
      </div>
    </div>
  </footer>;
}
