import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function AuthHomeLink() {
  return <Button asChild variant="outline" className="shrink-0">
    <Link to="/">
      <ArrowLeft aria-hidden="true" className="size-4" />
      Về trang chủ
    </Link>
  </Button>;
}
