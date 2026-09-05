import { listAssignmentsByClass } from '@mylife/classes';
import { getClassesDb, loadAssignmentsView } from '../../data';
import { createAssignmentAction } from '../../actions';
import { ClassesEmptyPanel, ClassesHero } from '../../ui';
import { AssignmentForm } from '@/components/classes/AssignmentForm';
import type { AssignmentRow } from '@mylife/classes';

export default function AssignmentAddPage() {
  const view = loadAssignmentsView();

  if (!view.currentSemester) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge="Assignments"
          title="No active semester"
          body="Create a semester first before adding assignments."
        />
        <ClassesEmptyPanel
          title="Set up a semester first"
          body="Assignments belong to a class inside an active semester."
          actionHref="/classes/settings"
          actionLabel="Open settings"
        />
      </div>
    );
  }

  if (view.classes.length === 0) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge={view.currentSemester.name}
          title="Add a class first"
          body="Assignments live inside a class. Add a class on the schedule first."
          actionHref="/classes"
          actionLabel="Open schedule"
        />
        <ClassesEmptyPanel
          title="No classes yet"
          body="Once you add classes, you can attach assignments to them."
          actionHref="/classes"
          actionLabel="Add class"
        />
      </div>
    );
  }

  const db = getClassesDb();
  const classAssignmentsByClass: Record<string, AssignmentRow[]> = {};
  for (const cls of view.classes) {
    classAssignmentsByClass[cls.id] = listAssignmentsByClass(db, cls.id);
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesHero
        badge="New assignment"
        title="Add an assignment"
        body="Pick a class, set a due date, and configure recurrence, dependencies, and late policy if needed."
        actionHref="/classes/assignments"
        actionLabel="Back to list"
      />
      <AssignmentForm
        classes={view.classes}
        classAssignmentsByClass={classAssignmentsByClass}
        reminderSummary={view.reminderSummary}
        onSubmit={createAssignmentAction}
      />
    </div>
  );
}
