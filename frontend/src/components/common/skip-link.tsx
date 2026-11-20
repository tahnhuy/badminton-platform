/** Lets keyboard users jump past the header; visible only while focused. */
export function SkipLink({ targetId = 'main-content' }: { targetId?: string }) {
  return <a href={`#${targetId}`} className="sr-only z-60 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
    Bỏ qua tới nội dung chính
  </a>;
}
