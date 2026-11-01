import { useState } from 'react';
import { Dialog } from './Dialog';

/** Same-origin media URLs are resolved and authorized by the server on every read. */
export function AuthorizedImage({ src, alt, expandable = false }: { src: string; alt: string; expandable?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  if (failed) return <span className="community-image-unavailable" role="status">Ảnh không khả dụng</span>;
  const image = <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
  return <>{expandable ? <button className="community-image-button" type="button" onClick={() => setOpen(true)} aria-label={`Xem ${alt}`}>{image}</button> : image}
    {open && <Dialog title="Ảnh bài viết" onClose={() => setOpen(false)} wide><img className="community-lightbox" src={src} alt={alt} onError={() => { setFailed(true); setOpen(false); }} /></Dialog>}
  </>;
}
