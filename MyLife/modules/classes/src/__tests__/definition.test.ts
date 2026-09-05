import { describe, expect, it } from 'vitest';
import { ModuleDefinitionSchema } from '@mylife/module-registry';
import { CLASSES_MODULE } from '../definition';

describe('CLASSES_MODULE definition', () => {
  it('passes runtime validation', () => {
    const result = ModuleDefinitionSchema.safeParse(CLASSES_MODULE);
    expect(result.success).toBe(true);
  });

  it('matches the shipped navigation contract', () => {
    expect(CLASSES_MODULE.schemaVersion).toBe(7);
    expect(CLASSES_MODULE.navigation.tabs.map((tab) => tab.key)).toEqual([
      'schedule',
      'assignments',
      'grades',
      'study',
      'degree',
      'lifelong',
      'applications',
      'tests',
      'settings',
    ]);
    expect(CLASSES_MODULE.navigation.screens.map((screen) => screen.name)).toEqual([
      'class-detail',
      'class-add',
      'class-edit',
      'teacher-detail',
      'teacher-add',
      'teacher-edit',
      'assignment-detail',
      'assignment-add',
      'assignment-edit',
      'degree-program-detail',
      'degree-program-add',
      'degree-program-edit',
      'degree-requirement-detail',
      'degree-requirement-add',
      'degree-requirement-edit',
      'lifelong-courses',
      'lifelong-course-detail',
      'lifelong-course-add',
      'lifelong-certifications',
      'lifelong-certification-detail',
      'lifelong-certification-add',
      'lifelong-goals',
      'lifelong-goal-detail',
      'lifelong-goal-add',
      'application-detail',
      'application-add',
      'application-edit',
      'standardized-test-detail',
      'standardized-test-add',
    ]);
  });
});
