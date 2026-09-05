'use client';

import { useEffect, useState } from 'react';
import { PET_SPECIES_CATALOG } from '@mylife/habits';
import {
  doEnsurePetState,
  doFeedPet,
  doPlayWithPet,
  doRestPet,
  doUpdatePetName,
  doUpdatePetSpecies,
  fetchPetCareState,
  fetchPetHistory,
  fetchPetState,
  fetchPetUnlockablesForState,
} from '../actions';
import {
  EmptyState,
  GlassPanel,
  PageIntro,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  SectionHeading,
  SymbolIcon,
  formatLongDate,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_STREAK, HB_TEXT_SECONDARY, HB_XP, withAlpha } from '@mylife/habits';

type PetState = {
  name: string;
  species: string;
  daysTogether: number;
  totalHabitsCompleted: number;
  createdAt: string;
};

type PetCareState = {
  hunger: number;
  happiness: number;
  energy: number;
  petXP: number;
  petLevel: number;
  mood: string;
};

type PetHistoryEntry = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
};

type PetUnlockable = {
  id: string;
  name: string;
  icon: string;
  category: string;
  requiredLevel: number;
  unlocked: boolean;
};

export default function HabitsPetPage() {
  const [pet, setPet] = useState<PetState | null>(null);
  const [care, setCare] = useState<PetCareState | null>(null);
  const [history, setHistory] = useState<PetHistoryEntry[]>([]);
  const [unlockables, setUnlockables] = useState<PetUnlockable[]>([]);
  const [draftName, setDraftName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      await doEnsurePetState();
      const [petRow, careRow, historyRows, unlockableRows] = await Promise.all([
        fetchPetState(),
        fetchPetCareState(),
        fetchPetHistory(),
        fetchPetUnlockablesForState(),
      ]);
      const nextPet = (petRow as PetState | null) ?? null;
      setPet(nextPet);
      setCare((careRow as PetCareState | null) ?? null);
      setHistory((historyRows as PetHistoryEntry[]) ?? []);
      setUnlockables((unlockableRows as PetUnlockable[]) ?? []);
      setDraftName(nextPet?.name ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pet sanctuary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const species = PET_SPECIES_CATALOG.find((entry) => entry.key === pet?.species);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Pet"
        title="Sanctuary status, care actions, and unlockables."
        description="The companion surface turns consistency into a living reward loop. Care stats, action history, and unlockables all stay visible so the pet feels like a system, not a gimmick."
      />

      {error ? <EmptyState body={error} title="Pet sanctuary unavailable" /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1.02fr 0.98fr', gap: 20 }}>
        <GlassPanel level={2} style={{ padding: 26, display: 'grid', gap: 18 }}>
          <SectionHeading detail="Tap actions to care for the companion." title="Sanctuary" />
          <div style={{ padding: 28, borderRadius: 28, background: `linear-gradient(135deg, ${withAlpha(HB_ACCENT_LIGHT, 0.2)} 0%, ${withAlpha(HB_STREAK.fire, 0.16)} 100%)`, display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 56 }}>{species?.emoji ?? '🐾'}</div>
                <div style={{ marginTop: 8, fontSize: 30, fontWeight: 800 }}>{pet?.name ?? 'Companion'}</div>
                <div style={{ color: '#E4E1E9', marginTop: 8 }}>{species?.description ?? 'Sanctuary companion'}</div>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: 24, background: withAlpha('#ffffff', 0.08), textAlign: 'center' }}>
                <div style={{ color: '#D6C3B5', fontSize: 12 }}>Level</div>
                <div style={{ marginTop: 6, fontSize: 30, fontWeight: 800, color: HB_XP }}>{care?.petLevel ?? 1}</div>
              </div>
            </div>
            <ProgressBar tone={HB_XP} value={care ? ((care.petXP % 120) / 120) * 100 : 0} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            {[
              ['Hunger', care?.hunger ?? 0, HB_STREAK.fire],
              ['Happy', care?.happiness ?? 0, HB_ACCENT_LIGHT],
              ['Energy', care?.energy ?? 0, HB_XP],
            ].map(([label, value, tone]) => (
              <div key={label} style={{ padding: 16, borderRadius: 20, background: withAlpha(String(tone), 0.12), display: 'grid', gap: 10 }}>
                <div style={{ color: '#D6C3B5', fontSize: 12 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{Math.round(Number(value))}%</div>
                <ProgressBar tone={String(tone)} value={Number(value)} />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <PrimaryButton onClick={() => void doFeedPet().then(load)}>
              <SymbolIcon color="#0E0E13" filled name="favorite" size={18} />
              Feed
            </PrimaryButton>
            <SecondaryButton onClick={() => void doPlayWithPet().then(load)}>
              <SymbolIcon name="sports_esports" size={18} />
              Play
            </SecondaryButton>
            <SecondaryButton onClick={() => void doRestPet().then(load)}>
              <SymbolIcon name="bedtime" size={18} />
              Rest
            </SecondaryButton>
          </div>
        </GlassPanel>

        <div style={{ display: 'grid', gap: 20 }}>
          <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }}>
            <SectionHeading detail="Name and species updates." title="Profile" />
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={() => pet ? void doUpdatePetName(draftName.trim() || pet.name).then(load) : undefined}
              style={{ borderRadius: 18, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '15px 16px', fontSize: 18, fontWeight: 700 }}
            />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {PET_SPECIES_CATALOG.map((entry) => (
                <button
                  key={entry.key}
                  onClick={() => void doUpdatePetSpecies(entry.key).then(load)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 999,
                    border: 'none',
                    background: pet?.species === entry.key ? withAlpha(HB_ACCENT_LIGHT, 0.18) : withAlpha('#ffffff', 0.04),
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  {entry.emoji} {entry.key}
                </button>
              ))}
            </div>
            <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>
              Together since {pet?.createdAt ? formatLongDate(pet.createdAt) : 'today'} · {pet?.daysTogether ?? 0} days together
            </div>
          </GlassPanel>

          <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 14 }}>
            <SectionHeading detail="Most recent care events." title="History" />
            {loading ? (
              <div style={{ height: 140, borderRadius: 20, background: withAlpha('#ffffff', 0.04) }} />
            ) : history.length === 0 ? (
              <EmptyState body="Interact with the pet to start building a care history." title="No sanctuary activity yet" />
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {history.slice(0, 5).map((entry) => (
                  <div key={entry.id} style={{ padding: 14, borderRadius: 18, background: withAlpha('#ffffff', 0.04), display: 'grid', gap: 6 }}>
                    <div style={{ fontWeight: 700 }}>{entry.title}</div>
                    <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>{entry.detail}</div>
                    <div style={{ color: '#9F8E81', fontSize: 12 }}>{formatLongDate(entry.timestamp)}</div>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>

          <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 14 }}>
            <SectionHeading detail="Items available at the current level." title="Unlockables" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {unlockables.map((item) => (
                <div key={item.id} style={{ padding: 14, borderRadius: 18, background: item.unlocked ? withAlpha(HB_ACCENT_LIGHT, 0.12) : withAlpha('#ffffff', 0.04), opacity: item.unlocked ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <SymbolIcon color={item.unlocked ? HB_ACCENT_LIGHT : HB_TEXT_SECONDARY} filled name={item.icon} size={18} />
                    <div style={{ fontWeight: 700 }}>{item.name}</div>
                  </div>
                  <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>Lv {item.requiredLevel} · {item.category}</div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
