/** Minimal footer (SH01): no placeholder links until the real content pages exist. */
export function PlayerFooter() {
  return <footer className="border-t border-border bg-card">
    <p className="mx-auto max-w-360 px-4 py-6 text-xs text-muted-foreground sm:px-6">
      SmashPro · Cộng đồng cầu lông · © {new Date().getFullYear()}
    </p>
  </footer>;
}
