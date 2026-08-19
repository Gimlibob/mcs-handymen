export function DocumentField({ label, className = "" }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-gold-bright">{label}</p>
      <div className="mt-1.5 min-h-[2.25rem] rounded-lg border border-border-soft bg-background px-3 py-2 text-sm text-foreground" />
    </div>
  );
}

export function DocumentArea({ label, rows = 3 }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gold-bright">{label}</p>
      <div
        className="mt-1.5 rounded-lg border border-border-soft bg-background px-3 py-2"
        style={{ minHeight: `${rows * 1.4}rem` }}
      />
    </div>
  );
}

export function ApprovalMethodLine() {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gold-bright">
        Approval Method
      </p>
      <p className="mt-2 text-sm text-foreground">
        <span className="mr-4">☐ Email</span>
        <span className="mr-4">☐ Text</span>
        <span>☐ Signature</span>
      </p>
    </div>
  );
}
