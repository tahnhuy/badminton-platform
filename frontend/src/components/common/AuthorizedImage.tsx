import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

/** Same-origin media URLs are resolved and authorized by the server on every read. */
export function AuthorizedImage({ src, alt, expandable = false }: { src: string; alt: string; expandable?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  if (failed) return <span role="status" className="flex min-h-30 flex-col items-center justify-center gap-2 bg-muted p-4 text-sm text-muted-foreground"><ImageOff aria-hidden="true" className="size-5" />Ảnh không khả dụng</span>;
  const image = <img src={src} alt={alt} loading="lazy" className="block size-full object-cover" onError={() => setFailed(true)} />;
  if (!expandable) return image;
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button type="button" aria-label={`Xem ${alt}`} className="block size-full min-w-0 overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{image}</button></DialogTrigger>
    <DialogContent className="max-w-270" aria-describedby={undefined}>
      <DialogTitle className="mb-4">Ảnh bài viết</DialogTitle>
      <img className="block max-h-[70dvh] w-full object-contain" src={src} alt={alt} onError={() => { setFailed(true); setOpen(false); }} />
    </DialogContent>
  </Dialog>;
}
