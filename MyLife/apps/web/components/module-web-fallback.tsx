import Link from 'next/link';

interface FallbackLink {
  href: string;
  label: string;
}

interface ModuleWebFallbackProps {
  moduleName: string;
  title?: string;
  routePath?: string;
  summary: string;
  accentColor: string;
  primaryHref: string;
  primaryLabel: string;
  links: FallbackLink[];
}

export function ModuleWebFallback({
  moduleName,
  summary,
  accentColor,
  primaryHref,
  primaryLabel,
  links,
}: ModuleWebFallbackProps) {
  return (
    <section
      style={{
        display: 'grid',
        gap: 20,
        padding: 28,
        borderRadius: 20,
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--glass-border)',
      }}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <span
          style={{
            width: 'fit-content',
            padding: '6px 10px',
            borderRadius: 999,
            backgroundColor: `${accentColor}18`,
            color: accentColor,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}
        >
          Web Beta
        </span>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, color: 'var(--text)' }}>
            {moduleName} Web
          </h1>
          <p
            style={{
              margin: '10px 0 0',
              color: 'var(--text-secondary)',
              fontSize: 16,
              lineHeight: 1.6,
            }}
          >
            {summary}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link
          href={primaryHref}
          style={{
            borderRadius: 999,
            backgroundColor: accentColor,
            color: '#FFFFFF',
            padding: '10px 16px',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          {primaryLabel}
        </Link>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              borderRadius: 999,
              border: '1px solid var(--glass-border)',
              color: 'var(--text-secondary)',
              padding: '10px 16px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div
        style={{
          padding: 18,
          borderRadius: 16,
          backgroundColor: 'var(--glass)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          fontSize: 14,
        }}
      >
        {moduleName} is included in MyLife, but the full native web rebuild is still in progress.
        This fallback keeps saved links alive while the consolidated web experience is finished.
      </div>
    </section>
  );
}
