export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: string;
  title: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mk-empty">
      {icon && (
        <div className="mk-empty-icon" aria-hidden>
          {icon}
        </div>
      )}
      <div className="mk-empty-title">{title}</div>
      {children && <div>{children}</div>}
    </div>
  );
}
