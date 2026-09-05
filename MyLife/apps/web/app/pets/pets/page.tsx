import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createPet, getPetDashboard, listPets, updatePet } from '@mylife/pets';
import type { PetSpecies } from '@mylife/pets';
import { getAdapter } from '@/lib/db';
import { shellStyles } from '../ui';

const SPECIES: PetSpecies[] = [
  'dog',
  'cat',
  'bird',
  'fish',
  'reptile',
  'rabbit',
  'small_mammal',
  'horse',
  'other',
];

export default async function PetsManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ petId?: string | string[] }>;
}) {
  const params = await searchParams;
  const petId = Array.isArray(params.petId) ? params.petId[0] : params.petId;
  const db = getAdapter();
  const pets = listPets(db, { includeArchived: true });
  const selectedPet = pets.find((pet) => pet.id === petId) ?? pets[0] ?? null;
  const selectedDashboard = selectedPet ? getPetDashboard(db, selectedPet.id) : null;

  async function addPet(formData: FormData) {
    'use server';

    try {
      const name = String(formData.get('name') ?? '').trim();
      if (!name) {
        return;
      }

      createPet(getAdapter(), crypto.randomUUID(), {
        name,
        species: String(formData.get('species') ?? 'dog') as PetSpecies,
        breed: String(formData.get('breed') ?? '').trim() || null,
        birthDate: String(formData.get('birthDate') ?? '').trim() || null,
      });
    } finally {
      revalidatePath('/pets');
      revalidatePath('/pets/pets');
      revalidatePath('/pets/health');
      revalidatePath('/pets/settings');
    }
  }

  async function toggleArchive(formData: FormData) {
    'use server';

    const id = String(formData.get('id') ?? '');
    const isArchived = String(formData.get('isArchived') ?? 'false') === 'true';
    if (!id) {
      return;
    }

    try {
      updatePet(getAdapter(), id, { isArchived });
    } finally {
      revalidatePath('/pets');
      revalidatePath('/pets/pets');
      revalidatePath('/pets/health');
      revalidatePath('/pets/settings');
    }
  }

  return (
    <div style={shellStyles.page}>
      <section style={shellStyles.hero}>
        <div style={shellStyles.heroTop}>
          <div>
            <div style={shellStyles.eyebrow}>MyPets</div>
            <h1 style={shellStyles.title}>Manage pet profiles on a wide canvas</h1>
            <p style={shellStyles.subtitle}>
              The full household roster, add form, and a detail-side summary all fit comfortably here.
            </p>
          </div>
        </div>

        <nav style={shellStyles.nav}>
          <Link href="/pets" style={shellStyles.navLink}>Dashboard</Link>
          <Link href="/pets/pets" style={shellStyles.navLinkActive}>Pets</Link>
          <Link href="/pets/health" style={shellStyles.navLink}>Health</Link>
          <Link href="/pets/settings" style={shellStyles.navLink}>Settings</Link>
        </nav>
      </section>

      <div style={shellStyles.split}>
        <section style={shellStyles.section}>
          <h2 style={shellStyles.sectionTitle}>Add pet</h2>
          <form action={addPet} style={shellStyles.list}>
            <div style={shellStyles.row}>
              <input name="name" placeholder="Pet name" style={shellStyles.input} />
              <select name="species" defaultValue="dog" style={shellStyles.input}>
                {SPECIES.map((species) => (
                  <option key={species} value={species}>{species}</option>
                ))}
              </select>
              <input name="breed" placeholder="Breed" style={shellStyles.input} />
              <input name="birthDate" placeholder="Birthday YYYY-MM-DD" style={shellStyles.input} />
            </div>
            <button type="submit" style={shellStyles.button}>Save pet</button>
          </form>

          <h2 style={shellStyles.sectionTitle}>Pet grid</h2>
          <div style={shellStyles.list}>
            {pets.length === 0 ? (
              <div style={shellStyles.empty}>No pets yet. Use the form above to create the first profile.</div>
            ) : pets.map((pet) => (
              <div key={pet.id} style={shellStyles.listCard}>
                <Link href={`/pets/pets?petId=${pet.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text)' }}>{pet.name}</div>
                  <div style={shellStyles.line}>
                    {pet.species}
                    {pet.breed ? ` · ${pet.breed}` : ''}
                    {pet.isArchived ? ' · archived' : ''}
                  </div>
                </Link>
                <form action={toggleArchive}>
                  <input type="hidden" name="id" value={pet.id} />
                  <input type="hidden" name="isArchived" value={String(!pet.isArchived)} />
                  <button type="submit" style={shellStyles.buttonSecondary}>
                    {pet.isArchived ? 'Restore' : 'Archive'}
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>

        <section style={shellStyles.section}>
          <h2 style={shellStyles.sectionTitle}>Detail panel</h2>
          {selectedPet && selectedDashboard ? (
            <div style={shellStyles.list}>
              <div style={shellStyles.listCard}>
                <div style={shellStyles.pill}>{selectedPet.species}</div>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>{selectedPet.name}</div>
                <div style={shellStyles.line}>{selectedPet.breed ?? 'Breed not set'}</div>
                <div style={shellStyles.line}>
                  {selectedDashboard.dueVaccinations} vaccines due · {selectedDashboard.dueMedications} meds due
                </div>
                <div style={shellStyles.line}>Last vet visit {selectedDashboard.lastVetVisitDate ?? 'none'}</div>
              </div>
              <div style={shellStyles.listCard}>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>Quick compare</div>
                <div style={shellStyles.line}>
                  Photo count {selectedDashboard.photoCount} · expenses ${(selectedDashboard.totalExpensesCents / 100).toFixed(0)}
                </div>
                <div style={shellStyles.line}>
                  Latest weight {selectedDashboard.latestWeightGrams ? `${(selectedDashboard.latestWeightGrams / 453.592).toFixed(1)} lb` : 'not logged'}
                </div>
              </div>
            </div>
          ) : (
            <div style={shellStyles.empty}>Select a pet card to open its summary panel.</div>
          )}
        </section>
      </div>
    </div>
  );
}
