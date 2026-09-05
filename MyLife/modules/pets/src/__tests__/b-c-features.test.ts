import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { PETS_MODULE } from '../definition';
import {
  createPet,
  deletePet,
  setExerciseGoal,
  getExerciseGoal,
  deleteExerciseGoal,
  createEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
  getPrimaryEmergencyContact,
  listEmergencyContacts,
  createInsurancePolicy,
  getInsurancePoliciesForPet,
  deleteInsurancePolicy,
  createInsuranceClaim,
  listClaimsForPolicy,
  updateClaimStatus,
  setExpenseBudget,
  getExpenseBudgets,
  createGroomingRecord,
  setGroomingInterval,
  getGroomingIntervals,
  updateGroomingRecord,
  deleteGroomingRecord,
  createGroomingRecordWithInterval,
  addTrainingCommand,
  updateCommandStatus,
  listTrainingCommands,
  createPetPhoto,
  updatePetPhoto,
  deletePetPhoto,
  getPhotosByMilestone,
  dismissAlert,
  getDismissedAlerts,
  undismissAlert,
  buildPetSitterCard,
} from '../db/crud';
import {
  calculateExerciseProgress,
  calculateExerciseStreak,
  getExerciseSummary,
  getBreedExerciseRecommendation,
} from '../engine/exercise';
import {
  calculateAnnualInsuranceCost,
  calculateClaimReimbursementRate,
  getInsuranceSummary,
} from '../engine/insurance';
import {
  calculateMonthlySpending,
  calculateBudgetProgress,
  getExpenseTrend,
} from '../engine/expenses';
import {
  calculateNextGroomingDate,
  getGroomingOverview,
} from '../engine/grooming-intervals';
import {
  calculateCommandProgress,
  getTrainingSummary,
  calculateTrainingStreak,
} from '../engine/training';
import { getPhotoStats } from '../engine/photos';
import {
  TRAINING_CURRICULUM,
  getNextLesson,
  getLevelProgress,
} from '../engine/lessons';
import {
  generateLostPetPoster,
  generateFoundPetPoster,
} from '../engine/poster';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('pets', PETS_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function createTestPet(id = 'pet1') {
  return createPet(testDb.adapter, id, { name: 'Luna', species: 'dog', breed: 'Golden Retriever' });
}

// ── 1. Exercise/Walk Log ─────────────────────────────────────────────

describe('Exercise Engine', () => {
  it('calculateExerciseProgress with goal', () => {
    const result = calculateExerciseProgress([{ durationMinutes: 45 }, { durationMinutes: 15 }], 60);
    expect(result.totalMinutes).toBe(60);
    expect(result.progressPct).toBe(100);
    expect(result.goalMet).toBe(true);
  });

  it('calculateExerciseProgress without goal', () => {
    const result = calculateExerciseProgress([{ durationMinutes: 30 }], null);
    expect(result.totalMinutes).toBe(30);
    expect(result.progressPct).toBeNull();
    expect(result.goalMet).toBeNull();
  });

  it('calculateExerciseStreak consecutive days', () => {
    const result = calculateExerciseStreak(['2026-03-22', '2026-03-21', '2026-03-20'], '2026-03-22');
    expect(result.streak).toBe(3);
  });

  it('calculateExerciseStreak broken streak', () => {
    const result = calculateExerciseStreak(['2026-03-22', '2026-03-20'], '2026-03-22');
    expect(result.streak).toBe(1);
  });

  it('calculateExerciseStreak empty', () => {
    const result = calculateExerciseStreak([], '2026-03-22');
    expect(result.streak).toBe(0);
  });

  it('getExerciseSummary', () => {
    const logs = [
      { durationMinutes: 45, distanceKm: 3.2, loggedAt: '2026-03-22T08:00:00Z' },
      { durationMinutes: 30, distanceKm: 2.0, loggedAt: '2026-03-21T08:00:00Z' },
    ];
    const result = getExerciseSummary(logs, 7);
    expect(result.totalMinutes).toBe(75);
    expect(result.totalDistanceKm).toBe(5.2);
    expect(result.exerciseDays).toBe(2);
    expect(result.restDays).toBe(5);
  });

  it('getBreedExerciseRecommendation for golden retriever', () => {
    const rec = getBreedExerciseRecommendation('dog', 'Golden Retriever');
    expect(rec).not.toBeNull();
    expect(rec!.minMinutes).toBe(60);
    expect(rec!.maxMinutes).toBe(120);
  });

  it('getBreedExerciseRecommendation returns null for cats', () => {
    expect(getBreedExerciseRecommendation('cat', 'Persian')).toBeNull();
  });
});

describe('Exercise Goal CRUD', () => {
  it('sets and gets exercise goal', () => {
    createTestPet();
    const goal = setExerciseGoal(testDb.adapter, 'g1', { petId: 'pet1', dailyGoalMinutes: 60 });
    expect(goal.dailyGoalMinutes).toBe(60);
    expect(getExerciseGoal(testDb.adapter, 'pet1')!.dailyGoalMinutes).toBe(60);
  });

  it('upserts exercise goal', () => {
    createTestPet();
    setExerciseGoal(testDb.adapter, 'g1', { petId: 'pet1', dailyGoalMinutes: 60 });
    const updated = setExerciseGoal(testDb.adapter, 'g2', { petId: 'pet1', dailyGoalMinutes: 90 });
    expect(updated.dailyGoalMinutes).toBe(90);
  });

  it('deletes exercise goal', () => {
    createTestPet();
    setExerciseGoal(testDb.adapter, 'g1', { petId: 'pet1', dailyGoalMinutes: 60 });
    deleteExerciseGoal(testDb.adapter, 'pet1');
    expect(getExerciseGoal(testDb.adapter, 'pet1')).toBeNull();
  });
});

// ── 2. Emergency Vet Info ────────────────────────────────────────────

describe('Emergency Contact Enhancements', () => {
  it('updates emergency contact', () => {
    createTestPet();
    createEmergencyContact(testDb.adapter, 'ec1', { label: 'Vet', clinicName: 'Pawsitive', phone: '555-1234' });
    const updated = updateEmergencyContact(testDb.adapter, 'ec1', { phone: '555-9999' });
    expect(updated!.phone).toBe('555-9999');
  });

  it('deletes emergency contact', () => {
    createTestPet();
    createEmergencyContact(testDb.adapter, 'ec1', { label: 'Vet', clinicName: 'Pawsitive', phone: '555-1234' });
    deleteEmergencyContact(testDb.adapter, 'ec1');
    expect(listEmergencyContacts(testDb.adapter)).toHaveLength(0);
  });

  it('gets primary emergency contact', () => {
    createTestPet();
    createEmergencyContact(testDb.adapter, 'ec1', { label: 'Vet', clinicName: 'Regular', phone: '555-1234' });
    createEmergencyContact(testDb.adapter, 'ec2', { label: 'Emergency', clinicName: 'ER Vet', phone: '555-5678', isPrimary: true });
    const primary = getPrimaryEmergencyContact(testDb.adapter);
    expect(primary!.clinicName).toBe('ER Vet');
  });
});

// ── 3. Pet Insurance ─────────────────────────────────────────────────

describe('Insurance Engine', () => {
  it('calculates annual insurance cost', () => {
    const cost = calculateAnnualInsuranceCost(
      [{ monthlyPremiumCents: 5000, endDate: null }],
      '2026-03-22',
    );
    expect(cost).toBe(60000);
  });

  it('excludes expired policies', () => {
    const cost = calculateAnnualInsuranceCost(
      [{ monthlyPremiumCents: 5000, endDate: '2026-01-01' }],
      '2026-03-22',
    );
    expect(cost).toBe(0);
  });

  it('calculates reimbursement rate', () => {
    const rate = calculateClaimReimbursementRate([
      { amountCents: 10000, reimbursementCents: 8000, status: 'approved' },
      { amountCents: 5000, reimbursementCents: 0, status: 'denied' },
    ]);
    expect(rate).toBe(53);
  });
});

describe('Insurance CRUD', () => {
  it('creates and lists policies', () => {
    createTestPet();
    createInsurancePolicy(testDb.adapter, 'ip1', {
      petId: 'pet1', provider: 'Trupanion', startDate: '2026-01-01', monthlyPremiumCents: 5000,
    });
    const policies = getInsurancePoliciesForPet(testDb.adapter, 'pet1');
    expect(policies).toHaveLength(1);
    expect(policies[0].provider).toBe('Trupanion');
  });

  it('creates and lists claims', () => {
    createTestPet();
    createInsurancePolicy(testDb.adapter, 'ip1', { petId: 'pet1', provider: 'Trupanion', startDate: '2026-01-01' });
    createInsuranceClaim(testDb.adapter, 'ic1', {
      policyId: 'ip1', claimDate: '2026-03-15', amountCents: 15000, description: 'X-ray',
    });
    expect(listClaimsForPolicy(testDb.adapter, 'ip1')).toHaveLength(1);
  });

  it('updates claim status', () => {
    createTestPet();
    createInsurancePolicy(testDb.adapter, 'ip1', { petId: 'pet1', provider: 'Trupanion', startDate: '2026-01-01' });
    createInsuranceClaim(testDb.adapter, 'ic1', {
      policyId: 'ip1', claimDate: '2026-03-15', amountCents: 15000, description: 'X-ray',
    });
    const updated = updateClaimStatus(testDb.adapter, 'ic1', 'approved', 12000, '2026-03-20');
    expect(updated!.status).toBe('approved');
    expect(updated!.reimbursementCents).toBe(12000);
  });

  it('cascade deletes claims when policy deleted', () => {
    createTestPet();
    createInsurancePolicy(testDb.adapter, 'ip1', { petId: 'pet1', provider: 'Trupanion', startDate: '2026-01-01' });
    createInsuranceClaim(testDb.adapter, 'ic1', { policyId: 'ip1', claimDate: '2026-03-15', amountCents: 15000, description: 'X-ray' });
    deleteInsurancePolicy(testDb.adapter, 'ip1');
    expect(listClaimsForPolicy(testDb.adapter, 'ip1')).toHaveLength(0);
  });
});

// ── 4. Expense Tracking Improvements ─────────────────────────────────

describe('Expense Engine', () => {
  it('calculateMonthlySpending groups by category', () => {
    const result = calculateMonthlySpending([
      { category: 'food', amountCents: 5000 },
      { category: 'vet', amountCents: 10000 },
      { category: 'food', amountCents: 3000 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ category: 'vet', totalCents: 10000 });
    expect(result[1]).toEqual({ category: 'food', totalCents: 8000 });
  });

  it('calculateBudgetProgress computes correctly', () => {
    const spending = [{ category: 'food', totalCents: 16000 }];
    const budgets = [{ category: 'food', monthlyBudgetCents: 20000 }];
    const result = calculateBudgetProgress(spending, budgets);
    expect(result[0].progressPct).toBe(80);
    expect(result[0].isWarning).toBe(true);
    expect(result[0].isOverBudget).toBe(false);
  });

  it('getExpenseTrend fills zero months', () => {
    const result = getExpenseTrend(
      [{ amountCents: 5000, spentOn: '2026-03-15' }],
      3,
      '2026-03-22',
    );
    expect(result).toHaveLength(3);
    expect(result[2].month).toBe('2026-03');
    expect(result[2].totalCents).toBe(5000);
    expect(result[0].totalCents).toBe(0);
  });
});

describe('Expense Budget CRUD', () => {
  it('sets and gets budgets', () => {
    createTestPet();
    setExpenseBudget(testDb.adapter, 'eb1', { petId: 'pet1', category: 'food', monthlyBudgetCents: 20000 });
    const budgets = getExpenseBudgets(testDb.adapter, 'pet1');
    expect(budgets).toHaveLength(1);
    expect(budgets[0].monthlyBudgetCents).toBe(20000);
  });

  it('upserts budget', () => {
    createTestPet();
    setExpenseBudget(testDb.adapter, 'eb1', { petId: 'pet1', category: 'food', monthlyBudgetCents: 20000 });
    setExpenseBudget(testDb.adapter, 'eb2', { petId: 'pet1', category: 'food', monthlyBudgetCents: 25000 });
    const budgets = getExpenseBudgets(testDb.adapter, 'pet1');
    expect(budgets).toHaveLength(1);
    expect(budgets[0].monthlyBudgetCents).toBe(25000);
  });
});

// ── 5. Multi-Pet Dashboard (engine reads existing data) ──────────────

describe('Multi-Pet Dashboard', () => {
  it('getInsuranceSummary aggregates correctly', () => {
    const summary = getInsuranceSummary(
      [{ monthlyPremiumCents: 5000, endDate: null }, { monthlyPremiumCents: 3000, endDate: '2025-12-31' }],
      [{ amountCents: 10000, reimbursementCents: 8000, status: 'approved' }, { amountCents: 5000, reimbursementCents: null, status: 'pending' }],
      '2026-03-22',
    );
    expect(summary.activePolicies).toBe(1);
    expect(summary.pendingClaims).toBe(1);
    expect(summary.annualPremiumCents).toBe(60000);
  });
});

// ── 6. Grooming Log ─────────────────────────────────────────────────

describe('Grooming Engine', () => {
  it('calculateNextGroomingDate', () => {
    expect(calculateNextGroomingDate('2026-03-22', 28)).toBe('2026-04-19');
  });

  it('getGroomingOverview', () => {
    const overview = getGroomingOverview(
      [{ groomingType: 'bath', groomedAt: '2026-03-10', nextDueDate: '2026-04-07' }],
      [{ groomingType: 'bath', intervalDays: 28 }],
      '2026-03-22',
    );
    expect(overview).toHaveLength(1);
    expect(overview[0].isOverdue).toBe(false);
    expect(overview[0].daysUntilDue).toBe(16);
  });
});

describe('Grooming CRUD', () => {
  it('sets grooming interval', () => {
    createTestPet();
    const interval = setGroomingInterval(testDb.adapter, 'gi1', { petId: 'pet1', groomingType: 'bath', intervalDays: 28 });
    expect(interval.intervalDays).toBe(28);
    expect(getGroomingIntervals(testDb.adapter, 'pet1')).toHaveLength(1);
  });

  it('creates grooming record with auto-scheduled next due', () => {
    createTestPet();
    setGroomingInterval(testDb.adapter, 'gi1', { petId: 'pet1', groomingType: 'bath', intervalDays: 28 });
    const record = createGroomingRecordWithInterval(testDb.adapter, 'gr1', {
      petId: 'pet1', groomingType: 'bath', groomedAt: '2026-03-22',
    });
    expect(record.nextDueDate).toBe('2026-04-19');
  });

  it('updates grooming record', () => {
    createTestPet();
    createGroomingRecord(testDb.adapter, 'gr1', { petId: 'pet1', groomingType: 'bath' });
    const updated = updateGroomingRecord(testDb.adapter, 'gr1', { provider: 'PetSmart' });
    expect(updated!.provider).toBe('PetSmart');
  });

  it('deletes grooming record', () => {
    createTestPet();
    createGroomingRecord(testDb.adapter, 'gr1', { petId: 'pet1', groomingType: 'bath' });
    deleteGroomingRecord(testDb.adapter, 'gr1');
  });
});

// ── 7. Pet Sitter Info Card (uses existing buildPetSitterCard) ───────
// Already tested in crud.test.ts. Engine tests for export formatting:

describe('Pet Sitter Card', () => {
  it('existing buildPetSitterCard returns structured data', () => {
    createTestPet();
    const card = buildPetSitterCard(testDb.adapter, 'pet1');
    expect(card).not.toBeNull();
    expect(card!.pet.name).toBe('Luna');
  });
});

// ── 8. Training Progress ─────────────────────────────────────────────

describe('Training Engine', () => {
  it('calculateCommandProgress detects auto-mastery', () => {
    const logs = Array(5).fill(null).map(() => ({ successRating: 4 }));
    const result = calculateCommandProgress(logs);
    expect(result.isAutoMastery).toBe(true);
    expect(result.averageRating).toBe(4);
  });

  it('calculateCommandProgress not mastered with low ratings', () => {
    const logs = Array(5).fill(null).map(() => ({ successRating: 3 }));
    const result = calculateCommandProgress(logs);
    expect(result.isAutoMastery).toBe(false);
  });

  it('getTrainingSummary', () => {
    const summary = getTrainingSummary([
      { status: 'mastered' }, { status: 'mastered' }, { status: 'learning' }, { status: 'practicing' },
    ]);
    expect(summary.masteredCount).toBe(2);
    expect(summary.masteryRate).toBe(50);
  });

  it('calculateTrainingStreak', () => {
    const result = calculateTrainingStreak(['2026-03-22', '2026-03-21'], '2026-03-22');
    expect(result.streak).toBe(2);
  });
});

describe('Training Command CRUD', () => {
  it('adds and lists commands', () => {
    createTestPet();
    addTrainingCommand(testDb.adapter, 'tc1', { petId: 'pet1', commandName: 'Sit' });
    const commands = listTrainingCommands(testDb.adapter, 'pet1');
    expect(commands).toHaveLength(1);
    expect(commands[0].status).toBe('learning');
  });

  it('updates command status to mastered', () => {
    createTestPet();
    addTrainingCommand(testDb.adapter, 'tc1', { petId: 'pet1', commandName: 'Sit' });
    const updated = updateCommandStatus(testDb.adapter, 'pet1', 'Sit', 'mastered');
    expect(updated!.status).toBe('mastered');
    expect(updated!.masteredAt).not.toBeNull();
  });

  it('deduplicate command names', () => {
    createTestPet();
    addTrainingCommand(testDb.adapter, 'tc1', { petId: 'pet1', commandName: 'Sit' });
    const dup = addTrainingCommand(testDb.adapter, 'tc2', { petId: 'pet1', commandName: 'Sit' });
    expect(dup.id).toBe('tc1');
    expect(listTrainingCommands(testDb.adapter, 'pet1')).toHaveLength(1);
  });
});

// ── 9. Photo Journal ─────────────────────────────────────────────────

describe('Photo Engine', () => {
  it('getPhotoStats', () => {
    const stats = getPhotoStats([
      { takenAt: '2026-01-15T10:00:00Z', createdAt: '2026-01-15T10:00:00Z', milestoneTag: 'first_day' },
      { takenAt: '2026-03-22T10:00:00Z', createdAt: '2026-03-22T10:00:00Z', milestoneTag: 'birthday' },
      { takenAt: null, createdAt: '2026-02-10T10:00:00Z', milestoneTag: 'first_day' },
    ]);
    expect(stats.totalCount).toBe(3);
    expect(stats.milestoneCounts['first_day']).toBe(2);
    expect(stats.milestoneCounts['birthday']).toBe(1);
  });
});

describe('Photo CRUD', () => {
  it('updates photo caption', () => {
    createTestPet();
    createPetPhoto(testDb.adapter, 'ph1', { petId: 'pet1', imageUri: '/img/luna.jpg' });
    const updated = updatePetPhoto(testDb.adapter, 'ph1', { caption: 'Luna at the park' });
    expect(updated!.caption).toBe('Luna at the park');
  });

  it('deletes photo', () => {
    createTestPet();
    createPetPhoto(testDb.adapter, 'ph1', { petId: 'pet1', imageUri: '/img/luna.jpg' });
    deletePetPhoto(testDb.adapter, 'ph1');
  });

  it('gets photos by milestone', () => {
    createTestPet();
    createPetPhoto(testDb.adapter, 'ph1', { petId: 'pet1', imageUri: '/img/1.jpg', milestoneTag: 'birthday' });
    createPetPhoto(testDb.adapter, 'ph2', { petId: 'pet1', imageUri: '/img/2.jpg', milestoneTag: 'silly' });
    const birthday = getPhotosByMilestone(testDb.adapter, 'pet1', 'birthday');
    expect(birthday).toHaveLength(1);
  });
});

// ── 10. Breed-Specific Health Alerts ─────────────────────────────────

describe('Dismissed Alerts CRUD', () => {
  it('dismisses and retrieves alerts', () => {
    createTestPet();
    dismissAlert(testDb.adapter, 'da1', 'pet1', 'dog:golden retriever:0');
    const dismissed = getDismissedAlerts(testDb.adapter, 'pet1');
    expect(dismissed).toHaveLength(1);
    expect(dismissed[0].alertId).toBe('dog:golden retriever:0');
  });

  it('undismisses alert', () => {
    createTestPet();
    dismissAlert(testDb.adapter, 'da1', 'pet1', 'dog:golden retriever:0');
    undismissAlert(testDb.adapter, 'pet1', 'dog:golden retriever:0');
    expect(getDismissedAlerts(testDb.adapter, 'pet1')).toHaveLength(0);
  });

  it('deduplicates dismissals', () => {
    createTestPet();
    dismissAlert(testDb.adapter, 'da1', 'pet1', 'dog:golden retriever:0');
    dismissAlert(testDb.adapter, 'da2', 'pet1', 'dog:golden retriever:0');
    expect(getDismissedAlerts(testDb.adapter, 'pet1')).toHaveLength(1);
  });
});

// ── 11. Dog Training Lessons ─────────────────────────────────────────

describe('Training Curriculum', () => {
  it('has 5 levels', () => {
    expect(TRAINING_CURRICULUM).toHaveLength(5);
  });

  it('each level has 5 lessons', () => {
    for (const level of TRAINING_CURRICULUM) {
      expect(level.lessons.length).toBe(5);
    }
  });

  it('getNextLesson returns first unmastered', () => {
    const next = getNextLesson(['Sit']);
    expect(next).not.toBeNull();
    expect(next!.lesson.command).toBe('Stay');
  });

  it('getNextLesson returns null when all mastered', () => {
    const all = TRAINING_CURRICULUM.flatMap((l) => l.lessons.map((le) => le.command));
    expect(getNextLesson(all)).toBeNull();
  });

  it('getLevelProgress', () => {
    const progress = getLevelProgress(1, ['Sit', 'Stay']);
    expect(progress).not.toBeNull();
    expect(progress!.mastered).toBe(2);
    expect(progress!.total).toBe(5);
    expect(progress!.progressPct).toBe(40);
  });
});

// ── 12. Lost Pet Poster ──────────────────────────────────────────────

describe('Lost Pet Poster', () => {
  it('generates lost pet poster HTML', () => {
    const html = generateLostPetPoster({
      petName: 'Luna',
      species: 'dog',
      breed: 'Golden Retriever',
      weightGrams: 30000,
      microchipId: 'ABC123456',
      imageBase64: null,
      lastSeenDate: '2026-03-22',
      lastSeenLocation: 'Central Park',
      contactPhone: '555-123-4567',
      colorMarkings: 'Golden coat, white chest',
      rewardAmount: '$100',
      additionalNotes: null,
    });
    expect(html).toContain('LOST PET');
    expect(html).toContain('Luna');
    expect(html).toContain('Golden Retriever');
    expect(html).toContain('555-123-4567');
    expect(html).toContain('ABC123456');
    expect(html).toContain('$100');
  });

  it('generates found pet poster HTML', () => {
    const html = generateFoundPetPoster({
      petName: 'Unknown',
      species: 'cat',
      breed: null,
      weightGrams: null,
      microchipId: null,
      imageBase64: null,
      foundDate: '2026-03-22',
      foundLocation: 'Near the coffee shop',
      lastSeenDate: '2026-03-22',
      lastSeenLocation: 'Near the coffee shop',
      contactPhone: '555-999-0000',
      colorMarkings: 'Orange tabby',
      additionalNotes: null,
    });
    expect(html).toContain('FOUND PET');
    expect(html).toContain('555-999-0000');
  });

  it('throws without contact phone', () => {
    expect(() =>
      generateLostPetPoster({
        petName: 'Luna', species: 'dog', breed: null, weightGrams: null,
        microchipId: null, imageBase64: null, lastSeenDate: '2026-03-22',
        lastSeenLocation: 'Park', contactPhone: '',
        colorMarkings: null, rewardAmount: null, additionalNotes: null,
      }),
    ).toThrow('Contact phone number is required');
  });

  it('uses species placeholder when no photo', () => {
    const html = generateLostPetPoster({
      petName: 'Luna', species: 'dog', breed: null, weightGrams: null,
      microchipId: null, imageBase64: null, lastSeenDate: '2026-03-22',
      lastSeenLocation: 'Park', contactPhone: '555-1234',
      colorMarkings: null, rewardAmount: null, additionalNotes: null,
    });
    expect(html).not.toContain('<img');
  });
});

// ── Cascade Delete ───────────────────────────────────────────────────

describe('V4 Cascade Delete', () => {
  it('deleting pet cascades to all V4 tables', () => {
    createTestPet();
    setExerciseGoal(testDb.adapter, 'g1', { petId: 'pet1', dailyGoalMinutes: 60 });
    createInsurancePolicy(testDb.adapter, 'ip1', { petId: 'pet1', provider: 'Trupanion', startDate: '2026-01-01' });
    setExpenseBudget(testDb.adapter, 'eb1', { petId: 'pet1', category: 'food', monthlyBudgetCents: 20000 });
    setGroomingInterval(testDb.adapter, 'gi1', { petId: 'pet1', groomingType: 'bath', intervalDays: 28 });
    addTrainingCommand(testDb.adapter, 'tc1', { petId: 'pet1', commandName: 'Sit' });
    dismissAlert(testDb.adapter, 'da1', 'pet1', 'dog:golden retriever:0');

    deletePet(testDb.adapter, 'pet1');

    expect(getExerciseGoal(testDb.adapter, 'pet1')).toBeNull();
    expect(getInsurancePoliciesForPet(testDb.adapter, 'pet1')).toHaveLength(0);
    expect(getExpenseBudgets(testDb.adapter, 'pet1')).toHaveLength(0);
    expect(getGroomingIntervals(testDb.adapter, 'pet1')).toHaveLength(0);
    expect(listTrainingCommands(testDb.adapter, 'pet1')).toHaveLength(0);
    expect(getDismissedAlerts(testDb.adapter, 'pet1')).toHaveLength(0);
  });
});
