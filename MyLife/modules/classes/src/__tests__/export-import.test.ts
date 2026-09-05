import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CLASSES_MODULE } from '../definition';
import {
  createAssignment,
  createClass,
  createSemester,
  createStudySession,
  createTeacher,
  saveClassesSettings,
} from '../db';
import {
  applyImport,
  loadFullExport,
} from '../db/crud/export-import';
import {
  assignmentsToCSV,
  buildExportBundle,
  bundleToJSON,
  classesToCSV,
  csvEscape,
  gradesCSV,
  parseImportJSON,
  planImport,
  semestersToCSV,
  studySessionsToCSV,
  teachersToCSV,
  type ClassesExportBundle,
  type PlanImportCurrent,
} from '../engine/export-import';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('classes', CLASSES_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;
});

afterEach(() => close());

function seedSampleDb() {
  saveClassesSettings(adapter, { defaultStudyMinutes: 50 });
  createSemester(adapter, 'sem-1', {
    name: 'Fall 2026',
    start_date: '2026-08-15',
    end_date: '2026-12-15',
    institution: 'State U',
    credit_hours: 15,
  });
  createTeacher(adapter, 't-1', { name: 'Dr. Smith' });
  createClass(adapter, 'c-1', {
    semester_id: 'sem-1',
    name: 'Intro CS',
    code: 'CS 101',
    credits: 3,
    teacher_id: 't-1',
    color: '#FF0000',
  });
  createClass(adapter, 'c-2', {
    semester_id: 'sem-1',
    name: 'Calculus I',
    code: 'MATH 110',
    credits: 4,
    color: '#00FF00',
  });
  createAssignment(adapter, 'a-1', {
    class_id: 'c-1',
    title: 'HW 1',
    type: 'homework',
    grade: 88,
    max_grade: 100,
    status: 'graded',
  });
  createAssignment(adapter, 'a-2', {
    class_id: 'c-1',
    title: 'Midterm',
    type: 'exam',
    grade: 92,
    max_grade: 100,
    status: 'graded',
  });
  createStudySession(adapter, 'ss-1', {
    class_id: 'c-1',
    started_at: '2026-09-01T15:00:00Z',
    duration_minutes: 60,
    location: 'Library',
    productivity_rating: 4,
  });
}

describe('export-import: bundle JSON round-trip', () => {
  it('serializes and parses a bundle', () => {
    seedSampleDb();
    const bundle = loadFullExport(adapter);
    const json = bundleToJSON(bundle);
    const parsed = parseImportJSON(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.bundle.app).toBe('MyClasses');
      expect(parsed.bundle.data.classes).toHaveLength(2);
      expect(parsed.bundle.data.assignments).toHaveLength(2);
    }
  });

  it('produces pretty JSON when requested', () => {
    seedSampleDb();
    const bundle = loadFullExport(adapter);
    const minified = bundleToJSON(bundle);
    const pretty = bundleToJSON(bundle, { pretty: true });
    expect(pretty).toContain('\n');
    expect(pretty.length).toBeGreaterThan(minified.length);
  });

  it('rejects empty / invalid JSON payloads', () => {
    expect(parseImportJSON('').ok).toBe(false);
    expect(parseImportJSON('not-json').ok).toBe(false);
    expect(parseImportJSON('[]').ok).toBe(false);
    expect(parseImportJSON('{"app":"Other","schema_version":1,"data":{},"exported_at":"x"}').ok).toBe(false);
    expect(parseImportJSON('{"app":"MyClasses","data":{},"exported_at":"x"}').ok).toBe(false);
  });
});

describe('export-import: planImport', () => {
  function emptyCurrent(): PlanImportCurrent {
    return {
      schemaVersion: 7,
      semesters: [],
      teachers: [],
      classes: [],
      assignments: [],
      studySessions: [],
      onlineCourses: [],
      certifications: [],
      learningGoals: [],
      degreePrograms: [],
      requirements: [],
      requirementSatisfactions: [],
      standardizedTests: [],
      applications: [],
      applicationTasks: [],
    };
  }

  it('detects creates vs updates', () => {
    seedSampleDb();
    const bundle = loadFullExport(adapter);
    const empty = emptyCurrent();
    const plan = planImport(bundle, empty);
    const semCreates = plan.to_create.find((p) => p.table === 'cs_semesters');
    expect(semCreates?.count).toBe(1);
    expect(plan.to_update).toEqual([]);

    // Re-importing into a current snapshot equal to the bundle = all updates.
    const cur: PlanImportCurrent = {
      ...empty,
      semesters: bundle.data.semesters,
      classes: bundle.data.classes,
      assignments: bundle.data.assignments,
    };
    const plan2 = planImport(bundle, cur);
    const semUpdates = plan2.to_update.find((p) => p.table === 'cs_semesters');
    expect(semUpdates?.count).toBe(1);
    const classUpdates = plan2.to_update.find((p) => p.table === 'cs_classes');
    expect(classUpdates?.count).toBe(2);
  });

  it('flags orphan assignments referencing unknown class_id', () => {
    const bundle: ClassesExportBundle = {
      schema_version: 7,
      exported_at: new Date().toISOString(),
      app: 'MyClasses',
      data: {
        settings: {},
        semesters: [],
        teachers: [],
        classes: [],
        assignments: [
          {
            id: 'a-orphan',
            class_id: 'missing-class',
            title: 'X',
            type: 'homework',
            description_md: null,
            due_at: null,
            submitted_at: null,
            graded_at: null,
            status: 'not_started',
            priority: 'medium',
            estimated_minutes: null,
            actual_minutes: null,
            grade: null,
            max_grade: 100,
            weight: null,
            is_recurring: 0,
            recurrence_rule: null,
            group_members: null,
            submission_notes: null,
            late_policy: null,
            depends_on: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        ],
        studySessions: [],
        onlineCourses: [],
        certifications: [],
        learningGoals: [],
        degreePrograms: [],
        requirements: [],
        requirementSatisfactions: [],
      },
    };
    const plan = planImport(bundle, emptyCurrent());
    const skip = plan.to_skip.find((s) => s.table === 'cs_assignments');
    expect(skip?.count).toBe(1);
    expect(plan.warnings.some((w) => w.includes('assignment'))).toBe(true);
  });

  it('warns when bundle schema is newer than current', () => {
    seedSampleDb();
    const bundle = loadFullExport(adapter);
    const downlevel: PlanImportCurrent = { ...emptyCurrent(), schemaVersion: 6 };
    bundle.schema_version = 8;
    const plan = planImport(bundle, downlevel);
    expect(plan.warnings.some((w) => w.includes('newer'))).toBe(true);
  });
});

describe('export-import: applyImport replace mode', () => {
  it('replaces existing data with bundle data', () => {
    seedSampleDb();
    const bundle = loadFullExport(adapter);

    // Mutate adapter: add an extra class that should be wiped.
    createClass(adapter, 'extra', {
      semester_id: 'sem-1',
      name: 'Extra',
      credits: 1,
      color: '#000000',
    });

    const result = applyImport(adapter, bundle, { mode: 'replace' });
    expect(result.errors).toEqual([]);

    const after = loadFullExport(adapter);
    expect(after.data.classes).toHaveLength(2);
    expect(after.data.classes.find((c) => c.id === 'extra')).toBeUndefined();
  });
});

describe('export-import: applyImport merge mode', () => {
  it('upserts bundle rows, preserving rows not in bundle', () => {
    seedSampleDb();
    const bundle = loadFullExport(adapter);

    // Add a class that is NOT in the bundle.
    createClass(adapter, 'extra', {
      semester_id: 'sem-1',
      name: 'Extra',
      credits: 1,
      color: '#000000',
    });

    const result = applyImport(adapter, bundle, { mode: 'merge' });
    expect(result.errors).toEqual([]);

    const after = loadFullExport(adapter);
    expect(after.data.classes.find((c) => c.id === 'extra')).toBeDefined();
    expect(after.data.classes).toHaveLength(3);
  });
});

describe('export-import: applyImport dryRun', () => {
  it('does not mutate the database', () => {
    seedSampleDb();
    const bundle = loadFullExport(adapter);

    const before = loadFullExport(adapter);
    const result = applyImport(adapter, bundle, { mode: 'replace', dryRun: true });
    const after = loadFullExport(adapter);

    expect(result.errors).toEqual([]);
    expect(after.data.classes).toHaveLength(before.data.classes.length);
    expect(after.data.assignments).toHaveLength(before.data.assignments.length);
  });
});

describe('export-import: CSV escaping', () => {
  it('does not quote simple values', () => {
    expect(csvEscape('hello')).toBe('hello');
    expect(csvEscape(42)).toBe('42');
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('quotes fields containing comma, quote, or newline', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('export-import: per-entity CSV', () => {
  it('exports semesters with CRLF terminator', () => {
    seedSampleDb();
    const bundle = loadFullExport(adapter);
    const csv = semestersToCSV(bundle.data.semesters);
    expect(csv).toMatch(/\r\n$/);
    expect(csv.split('\r\n')[0]).toBe(
      'id,name,start_date,end_date,institution,credit_hours,gpa,is_current,created_at',
    );
    const dataLine = csv.split('\r\n')[1];
    expect(dataLine).toContain('sem-1');
    expect(dataLine).toContain('Fall 2026');
  });

  it('exports classes including formatted category_weights and day_times', () => {
    seedSampleDb();
    const bundle = loadFullExport(adapter);
    const csv = classesToCSV(bundle.data.classes);
    expect(csv.startsWith('id,semester_id,name,code,section,credits,day_times')).toBe(true);
    expect(csv).toContain('CS 101');
    expect(csv).toContain('MATH 110');
  });

  it('exports assignments', () => {
    seedSampleDb();
    const bundle = loadFullExport(adapter);
    const csv = assignmentsToCSV(bundle.data.assignments);
    expect(csv).toContain('HW 1');
    expect(csv).toContain('Midterm');
    expect(csv).toContain('homework');
  });

  it('exports study sessions', () => {
    seedSampleDb();
    const bundle = loadFullExport(adapter);
    const csv = studySessionsToCSV(bundle.data.studySessions);
    expect(csv).toContain('Library');
    expect(csv).toContain('60');
  });

  it('exports teachers', () => {
    seedSampleDb();
    const bundle = loadFullExport(adapter);
    const csv = teachersToCSV(bundle.data.teachers);
    expect(csv).toContain('Dr. Smith');
  });
});

describe('export-import: gradesCSV (wide format)', () => {
  it('produces one row per class with one column per assignment title', () => {
    seedSampleDb();
    const bundle = loadFullExport(adapter);
    const csv = gradesCSV(bundle.data.classes, bundle.data.assignments);
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(3); // header + 2 classes
    expect(lines[0]).toContain('HW 1');
    expect(lines[0]).toContain('Midterm');

    const c1Line = lines.find((l) => l.startsWith('c-1,'))!;
    expect(c1Line).toContain('88/100');
    expect(c1Line).toContain('92/100');

    const c2Line = lines.find((l) => l.startsWith('c-2,'))!;
    // c-2 has no assignments in this seed -> empty cells.
    const c2Cells = c2Line.split(',');
    expect(c2Cells[c2Cells.length - 1]).toBe('');
  });

  it('escapes assignment titles containing commas in header', () => {
    const classes = [
      {
        id: 'c-1',
        semester_id: 's-1',
        name: 'Intro',
        code: null,
        section: null,
        credits: 3,
        day_times: '[]',
        room: null,
        building: null,
        teacher_id: null,
        category_weights: null,
        current_grade: null,
        target_grade: null,
        color: '#000',
        notes_md: null,
        created_at: '2026',
        updated_at: '2026',
      },
    ];
    const assignments = [
      {
        id: 'a-1',
        class_id: 'c-1',
        title: 'Essay, Final',
        type: 'essay' as const,
        description_md: null,
        due_at: null,
        submitted_at: null,
        graded_at: null,
        status: 'graded' as const,
        priority: 'medium' as const,
        estimated_minutes: null,
        actual_minutes: null,
        grade: 90,
        max_grade: 100,
        weight: null,
        is_recurring: 0 as const,
        recurrence_rule: null,
        group_members: null,
        submission_notes: null,
        late_policy: null,
        depends_on: null,
        created_at: '2026',
        updated_at: '2026',
      },
    ];
    const csv = gradesCSV(classes, assignments);
    expect(csv.split('\r\n')[0]).toContain('"Essay, Final"');
  });
});

describe('export-import: buildExportBundle directly', () => {
  it('stamps app tag, schema version, and exported_at', () => {
    const now = new Date('2026-04-20T12:00:00Z');
    const bundle = buildExportBundle({
      schemaVersion: 7,
      settings: { theme: 'dark' },
      semesters: [],
      teachers: [],
      classes: [],
      assignments: [],
      studySessions: [],
      onlineCourses: [],
      certifications: [],
      learningGoals: [],
      degreePrograms: [],
      requirements: [],
      requirementSatisfactions: [],
      now,
    });
    expect(bundle.app).toBe('MyClasses');
    expect(bundle.schema_version).toBe(7);
    expect(bundle.exported_at).toBe(now.toISOString());
    expect(bundle.data.settings.theme).toBe('dark');
  });
});
