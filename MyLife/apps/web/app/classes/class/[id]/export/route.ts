import { NextResponse } from 'next/server';
import {
  classToICS,
  classesToICS,
  getClass,
  getSemester,
  listClassesBySemester,
} from '@mylife/classes';
import { getClassesDb } from '../../../data';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getClassesDb();
  const cls = getClass(db, id);
  if (!cls) {
    return new NextResponse('Class not found', { status: 404 });
  }
  const semester = getSemester(db, cls.semester_id);
  if (!semester) {
    return new NextResponse('Semester not found', { status: 404 });
  }

  const url = new URL(_request.url);
  const all = url.searchParams.get('semester') === '1';
  const ics = all
    ? classesToICS(listClassesBySemester(db, semester.id), semester)
    : classToICS(cls, semester);

  const filenameBase = all ? semester.name : cls.name;
  const filename = `${filenameBase.replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase()}.ics`;

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
