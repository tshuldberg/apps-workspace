import { describe, expect, it } from 'vitest';
import { EVENT_TEMPLATES, getTemplates, getTemplateById, applyTemplate } from '../engines/templates';

describe('templates engine', () => {
  it('has exactly 12 templates', () => {
    expect(EVENT_TEMPLATES).toHaveLength(12);
    expect(getTemplates()).toHaveLength(12);
  });

  it('each template has required fields', () => {
    for (const t of EVENT_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(typeof t.suggestedDurationHours).toBe('number');
      expect(t.suggestedDurationHours).toBeGreaterThan(0);
      expect(t.suggestedDescription).toBeTruthy();
      expect(t.suggestedSettings).toBeDefined();
      expect(Array.isArray(t.suggestedQuestions)).toBe(true);
      expect(Array.isArray(t.hostChecklist)).toBe(true);
      expect(t.hostChecklist.length).toBeGreaterThan(0);
    }
  });

  it('each template has unique ID', () => {
    const ids = EVENT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('suggestedSettings only contains valid Event field keys', () => {
    const validKeys = new Set([
      'requiresApproval', 'allowPlusOnes', 'maxGuests', 'allowPhotoAlbum',
      'allowComments', 'allowPolls', 'allowCohosts', 'allowChipIn',
      'waitlistEnabled', 'visibility',
    ]);
    for (const t of EVENT_TEMPLATES) {
      for (const key of Object.keys(t.suggestedSettings)) {
        expect(validKeys.has(key)).toBe(true);
      }
    }
  });

  it('suggestedQuestions use valid QuestionType values', () => {
    const validTypes = new Set(['text', 'single', 'multi', 'number', 'boolean', 'dietary']);
    for (const t of EVENT_TEMPLATES) {
      for (const q of t.suggestedQuestions) {
        expect(validTypes.has(q.type)).toBe(true);
      }
    }
  });

  it('getTemplateById returns birthday template', () => {
    const birthday = getTemplateById('birthday');
    expect(birthday).not.toBeNull();
    expect(birthday!.name).toBe('Birthday Party');
    expect(birthday!.suggestedDurationHours).toBe(3);
  });

  it('getTemplateById returns null for unknown ID', () => {
    expect(getTemplateById('nonexistent')).toBeNull();
  });

  it('applyTemplate returns correct values for birthday', () => {
    const result = applyTemplate('birthday');
    expect(result).not.toBeNull();
    expect(result!.templateName).toBe('Birthday Party');
    expect(result!.suggestedDurationHours).toBe(3);
    expect(result!.suggestedQuestions).toHaveLength(1);
    expect(result!.suggestedQuestions[0].type).toBe('dietary');
    expect(result!.hostChecklist.length).toBeGreaterThan(0);
  });

  it('applyTemplate returns correct values for dinner_party', () => {
    const result = applyTemplate('dinner_party');
    expect(result).not.toBeNull();
    expect(result!.templateName).toBe('Dinner Party');
    expect(result!.suggestedSettings).toHaveProperty('maxGuests', 12);
  });

  it('applyTemplate returns null for unknown template ID', () => {
    expect(applyTemplate('nonexistent')).toBeNull();
  });

  it('template with dietary question creates correct question structure', () => {
    const birthday = getTemplateById('birthday')!;
    const dietaryQ = birthday.suggestedQuestions.find((q) => q.type === 'dietary');
    expect(dietaryQ).toBeDefined();
    expect(dietaryQ!.label).toBe('Any dietary restrictions?');
    expect(dietaryQ!.sortOrder).toBe(100);
  });
});
