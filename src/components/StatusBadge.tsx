export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-ok/20 text-ok border-ok/40",
    redeemed: "bg-amber/15 text-amber-soft border-amber/30",
    expired: "bg-muted/10 text-muted border-muted/30",
  };

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs uppercase tracking-wider border ${styles[status] || styles.expired}`}
    >
      {status}
    </span>
  );
}
