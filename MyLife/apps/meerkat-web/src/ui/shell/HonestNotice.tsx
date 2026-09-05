// HonestNotice: the recurring transparency callout. Every claim the app makes
// about what is and is not wired lives in one of these. No fabrication.

export function HonestNotice({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mk-notice" role="note">
      <span aria-hidden>ℹ</span>
      <span>{children}</span>
    </div>
  );
}
