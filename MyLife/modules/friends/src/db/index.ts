export { INIT_TABLES, INIT_INDEXES } from './schema';

// ── CRUD ───────────────────────────────────────────────────────────
export {
  createPerson,
  getPerson,
  updatePerson,
  deletePerson,
  archivePerson,
  unarchivePerson,
  listPeople,
  searchPeople,
  createCircle,
  getCircle,
  updateCircle,
  deleteCircle,
  listCircles,
  addMember,
  removeMember,
  getCirclesForPerson,
  removePersonFromAllCircles,
} from './crud';
