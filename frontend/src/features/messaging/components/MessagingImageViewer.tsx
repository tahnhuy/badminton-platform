import { ZoomIn, ZoomOut, Download, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
export function MessagingImageViewer({ url, zoom, onZoom, onClose }: { url: string; zoom: number; onZoom: (value: number | ((value: number) => number)) => void; onClose: () => void }) {
  const transform = { transform: `scale(${zoom})` };
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent showClose={false} className="z-1100 flex max-h-[94svh] max-w-[94vw] flex-col gap-4 overflow-hidden bg-card" overlayClassName="z-1100">
      <DialogTitle className="sr-only">Xem ảnh phóng to</DialogTitle>
      <DialogDescription className="sr-only">Ảnh đính kèm cuộc trò chuyện</DialogDescription>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <Button type="button" variant="outline" size="icon" title="Thu nhỏ" aria-label="Thu nhỏ" onClick={() => onZoom(z => Math.max(0.5, Number((z - 0.25).toFixed(2))))}>
          <ZoomOut aria-hidden="true" />
        </Button>
        <Button type="button" variant="outline" title="Đặt lại kích thước 100%" onClick={() => onZoom(1)}>{Math.round(zoom * 100)}%</Button>
        <Button type="button" variant="outline" size="icon" title="Phóng to" aria-label="Phóng to" onClick={() => onZoom(z => Math.min(3, Number((z + 0.25).toFixed(2))))}>
          <ZoomIn aria-hidden="true" />
        </Button>
        <Button asChild variant="outline">
          <a href={url} download="chat-image" title="Tải ảnh xuống">
            <Download aria-hidden="true" />Tải xuống</a>
        </Button>
        <Button type="button" variant="ghost" size="icon" title="Đóng (Esc)" aria-label="Đóng (Esc)" onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      </div>
      <div className="flex min-h-0 items-center justify-center overflow-auto">
        <img src={url} alt="Xem ảnh lớn" className="max-h-[76svh] max-w-full rounded-lg object-contain transition-transform duration-200 motion-reduce:transition-none" style={transform} onDoubleClick={() => onZoom(z => z === 1 ? 1.75 : 1)} />
      </div>
    </DialogContent>
  </Dialog>;
}
