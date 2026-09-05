/**
 * Journal bridge (P9-F): pure helper producing academic reflection prompts a
 * MyJournal screen can pre-fill into a new entry.
 */

import type { ClassRow, SemesterRow } from '../models/schemas';

export interface AcademicReflectionPrompt {
  title: string;
  body: string;
  tag: 'academic';
}

/**
 * Build a small set of reflection prompts for end-of-semester or mid-semester
 * journaling. Always returns at least 3 prompts; includes class-specific ones
 * when classes are present, and a GPA prompt when `gpa` is provided.
 */
export function buildAcademicReflectionPrompts(
  semester: Pick<SemesterRow, 'id' | 'name'>,
  classes: Pick<ClassRow, 'id' | 'name' | 'code'>[],
  gpa?: number | null,
): AcademicReflectionPrompt[] {
  const prompts: AcademicReflectionPrompt[] = [];
  const semLabel = semester.name;

  prompts.push({
    title: `${semLabel} reflection`,
    body: `What went well this semester? What would I do differently?`,
    tag: 'academic',
  });

  prompts.push({
    title: `${semLabel} habits review`,
    body: `Which study habits actually moved the needle? Which were noise?`,
    tag: 'academic',
  });

  if (typeof gpa === 'number' && Number.isFinite(gpa)) {
    prompts.push({
      title: `${semLabel} GPA: ${gpa.toFixed(2)}`,
      body: `What does this number tell me — and what does it leave out?`,
      tag: 'academic',
    });
  }

  for (const cls of classes.slice(0, 3)) {
    const label = cls.code?.trim() || cls.name;
    prompts.push({
      title: `${label} — wrap-up`,
      body: `Biggest takeaway from ${cls.name}? What stuck with me?`,
      tag: 'academic',
    });
  }

  if (classes.length === 0) {
    prompts.push({
      title: `${semLabel} — looking ahead`,
      body: `What do I want next semester to look like?`,
      tag: 'academic',
    });
  }

  return prompts;
}
