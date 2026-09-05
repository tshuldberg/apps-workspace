import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PRESETS, getPreset, resolveProfile, type MkPaletteMode } from '@mylife/meerkat-theme';
import { ONBOARDING_EXPERIENCES, findOnboardingExperience, type ExperienceId } from '../../lib/onboarding-experience-core';
import './experience-chooser.css';

export interface ExperienceChooserProps {
  stage: 'intro' | 'layout' | 'theme';
  name: string;
  experienceId: ExperienceId;
  themeId: string;
  onExperienceChange: (id: ExperienceId) => void;
  onThemeChange: (id: string) => void;
}

export function ExperienceChooser({ stage, name, experienceId, themeId, onExperienceChange, onThemeChange }: ExperienceChooserProps): React.ReactElement {
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const section = sectionRef.current;
    const modal = section?.closest('[data-mk-modal]');
    if (modal) modal.scrollTop = 0;
    section?.querySelector('h3')?.focus({ preventScroll: true });
  }, [stage]);
  const [mode, setMode] = useState<MkPaletteMode>('light');
  const experience = findOnboardingExperience(stage === 'intro' ? 'standard' : experienceId)!;
  const profile = getPreset(stage === 'theme' ? themeId : 'open-burrow')!;
  const colors = resolveProfile(profile, mode);
  const previewStyle = {
    '--preview-background': colors.background, '--preview-surface': colors.surface,
    '--preview-text': colors.text, '--preview-accent': colors.accent,
    '--preview-border': colors.borderStrong, '--preview-high': colors.surfaceHigh,
  } as CSSProperties;
  return (
    <section ref={sectionRef} className="mk-experience" aria-label={stage === 'theme' ? 'Community theme' : 'Community layout'}>
      {stage === 'intro' ? <>
        <h3 tabIndex={-1}>Your standard community</h3>
        <p className="mk-muted">Start with general chat and announcements. Keep this layout, or choose a different way to organize your community.</p>
      </> : <>
        <h3 tabIndex={-1}>{stage === 'layout' ? 'How should your community feel?' : 'Choose a theme for this layout'}</h3>
        <p className="mk-muted">{stage === 'layout' ? 'Choose a starting point. You can edit your layout later in community settings.' : 'This theme belongs to your new community. Your personal app theme stays the same.'}</p>
      </>}
      <div className={`mk-experience-preview is-${experience.id}`} style={previewStyle} aria-label={`${experience.name} layout preview`}>
        <div className="mk-experience-preview-head"><strong>{name.trim() || 'Your community'}</strong><span>{experience.ready ? 'Layout preview' : 'Starter layout preview'}</span></div>
        <div className="mk-experience-preview-body" aria-hidden="true">
          {experience.preview.map((label, i) => <div key={label} className={`mk-experience-preview-part part-${i}`}><span>{label}</span><i /><i /></div>)}
        </div>
        <div className="mk-experience-preview-foot">{experience.name} · {stage === 'theme' ? profile.name : 'Open Burrow'}</div>
      </div>
      {stage !== 'intro' && <p className="mk-experience-description" role="status">{experience.description}{!experience.ready && ' You can load this starter now. Unfinished features show a notice; chat stays available.'}</p>}
      {stage === 'layout' && <div className="mk-experience-options" aria-label="Layouts">
        {ONBOARDING_EXPERIENCES.map((item) => <button type="button" key={item.id} className="mk-experience-option" aria-pressed={experienceId === item.id} onClick={() => onExperienceChange(item.id)}>
          <strong>{item.name}{experienceId === item.id ? ' ✓' : ''}</strong>
          <span>{item.reference}</span>
          {!item.ready && <small>Starter · Media unfinished</small>}
        </button>)}
      </div>}
      {stage === 'theme' && <>
        <div className="mk-btn-row" aria-label="Preview appearance">
          {(['light', 'dark'] as const).map((value) => <button type="button" className="mk-experience-mode" key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === 'light' ? 'Light preview' : 'Dark preview'}</button>)}
        </div>
        <div className="mk-experience-options mk-experience-themes" aria-label="Themes">
          {PRESETS.map((theme) => {
            const palette = resolveProfile(theme, mode);
            return <button type="button" key={theme.id} className="mk-experience-option" aria-pressed={themeId === theme.id} onClick={() => onThemeChange(theme.id)}>
              <span className="mk-experience-swatches" aria-hidden="true">{[palette.background, palette.surface, palette.accent, palette.text].map((color, i) => <i key={i} style={{ backgroundColor: color }} />)}</span>
              <strong>{theme.name}{themeId === theme.id ? ' ✓' : ''}</strong>
            </button>;
          })}
        </div>
      </>}
    </section>
  );
}
