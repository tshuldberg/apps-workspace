import type { ReactElement } from 'react';
import type { AudienceRule } from '@mylife/sync';

export function AudienceBadge({ rule }: { rule: AudienceRule }): ReactElement {
  return (
    <span className={`mk-audience-badge ${rule.type === 'public' ? 'is-public' : ''}`}>
      {rule.label}
    </span>
  );
}

export function AudienceRuleSummary({
  rule,
  title = 'Who can see this?',
}: {
  rule: AudienceRule;
  title?: string;
}): ReactElement {
  return (
    <div className="mk-audience-summary">
      <div className="mk-audience-summary-head">
        <span className="mk-audience-title">{title}</span>
        <AudienceBadge rule={rule} />
      </div>
      <div className="mk-audience-copy">{rule.explanation} {rule.replyNotice}</div>
      {rule.hostedNotice ? <div className="mk-audience-cost">{rule.hostedNotice}</div> : null}
    </div>
  );
}

export function AudienceSelector({
  value,
  options,
  onChange,
}: {
  value: AudienceRule;
  options: readonly AudienceRule[];
  onChange: (rule: AudienceRule) => void;
}): ReactElement {
  return (
    <div className="mk-audience-selector">
      {options.map((option) => {
        const selected = option.type === value.type;
        return (
          <button
            key={option.type}
            type="button"
            className={`mk-audience-option ${selected ? 'is-selected' : ''}`}
            aria-pressed={selected}
            onClick={() => onChange(option)}
          >
            <span className="mk-audience-option-copy">
              <span className="mk-audience-option-label">{option.label}</span>
              <span className="mk-audience-option-hint">{option.explanation}</span>
              {option.hostedNotice ? <span className="mk-audience-cost">{option.hostedNotice}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
