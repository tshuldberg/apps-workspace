import { redirect } from 'next/navigation';
import {
  addBudgetFamilyMember,
  createBudgetFamily,
  fetchBudgetFamilySnapshot,
  joinBudgetFamily,
  saveBudgetEnvelopeSharingMode,
} from '../actions';
import {
  BudgetColumns,
  BudgetField,
  BudgetForm,
  BudgetFormGrid,
  BudgetHero,
  BudgetInput,
  BudgetPage,
  BudgetPanel,
  BudgetSelect,
  BudgetTable,
} from '../primitives';
import { nullableField, stringField } from '../route-utils';
import { BudgetMetricCard, buttonStyle } from '../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetFamilyPage() {
  const snapshot = await fetchBudgetFamilySnapshot();

  async function createFamilyAction(formData: FormData) {
    'use server';

    await createBudgetFamily({
      name: nullableField(formData, 'name') ?? undefined,
      ownerEmoji: nullableField(formData, 'owner_emoji') ?? undefined,
      ownerName: nullableField(formData, 'owner_name') ?? undefined,
    });
    redirect('/budget/family');
  }

  async function joinFamilyAction(formData: FormData) {
    'use server';

    await joinBudgetFamily(stringField(formData, 'invite_code'), stringField(formData, 'member_name'));
    redirect('/budget/family');
  }

  async function addMemberAction(formData: FormData) {
    'use server';

    if (!snapshot.family) {
      redirect('/budget/family');
    }

    await addBudgetFamilyMember({
      avatar_emoji: stringField(formData, 'avatar_emoji') || '🧾',
      device_id: `web-${Date.now()}`,
      display_name: stringField(formData, 'display_name'),
      family_id: snapshot.family.id,
      role: stringField(formData, 'role') as 'admin' | 'member' | 'owner' | 'viewer',
    });
    redirect('/budget/family');
  }

  async function saveSharingAction(formData: FormData) {
    'use server';

    if (!snapshot.family) {
      redirect('/budget/family');
    }

    await saveBudgetEnvelopeSharingMode({
      envelope_id: stringField(formData, 'envelope_id'),
      family_id: snapshot.family.id,
      sharing_mode: stringField(formData, 'sharing_mode') as 'private' | 'shared' | 'visible',
    });
    redirect('/budget/family');
  }

  return (
    <BudgetPage>
      <BudgetHero
        description="Family workspace parity with invite codes, member roster, and envelope visibility controls."
        eyebrow="Family"
        title="Family Sharing"
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <BudgetMetricCard label="Workspace" subvalue="Current family name" tone="accent" value={snapshot.family?.name ?? 'Not set'} />
          <BudgetMetricCard label="Invite Code" subvalue="Share with another device or member" tone="info" value={snapshot.family?.invite_code ?? 'Create one'} />
          <BudgetMetricCard label="Members" subvalue="Active family roster" tone="money" value={snapshot.members.length} />
        </div>
      </BudgetHero>

      <BudgetColumns
        primary={
          <>
            <BudgetPanel description="Recent family sync activity." title="Activity">
              <BudgetTable
                columns={['Time', 'Operation', 'Summary']}
                rows={snapshot.activity.length > 0
                  ? snapshot.activity.map((entry) => [
                      entry.timestamp,
                      entry.operation,
                      (() => {
                        try {
                          return JSON.parse(entry.payload).summary ?? entry.table_name;
                        } catch {
                          return entry.table_name;
                        }
                      })(),
                    ])
                  : [['No family activity', '-', '-']]}
              />
            </BudgetPanel>

            <BudgetPanel description="Envelope visibility by family mode." title="Sharing Modes">
              <BudgetTable
                columns={['Envelope', 'Mode']}
                rows={snapshot.envelopes.map((envelope) => [
                  envelope.name,
                  snapshot.sharingModes.find((mode) => mode.envelope_id === envelope.id)?.sharing_mode ?? 'private',
                ])}
              />
              {snapshot.family ? (
                <form action={saveSharingAction} style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                    <BudgetSelect defaultValue={snapshot.envelopes[0]?.id} name="envelope_id">
                      {snapshot.envelopes.map((envelope) => (
                        <option key={envelope.id} value={envelope.id}>
                          {envelope.name}
                        </option>
                      ))}
                    </BudgetSelect>
                    <BudgetSelect defaultValue="shared" name="sharing_mode">
                      <option value="shared">shared</option>
                      <option value="visible">visible</option>
                      <option value="private">private</option>
                    </BudgetSelect>
                  </div>
                  <button style={buttonStyle('secondary')} type="submit">
                    Save Sharing Mode
                  </button>
                </form>
              ) : null}
            </BudgetPanel>
          </>
        }
        secondary={
          <>
            <BudgetForm action={createFamilyAction} title="Create Workspace">
              <BudgetFormGrid>
                <BudgetField label="Family Name">
                  <BudgetInput name="name" placeholder="Budget Circle" />
                </BudgetField>
                <BudgetField label="Owner Name">
                  <BudgetInput name="owner_name" placeholder="You" />
                </BudgetField>
                <BudgetField label="Owner Emoji">
                  <BudgetInput name="owner_emoji" placeholder="🪙" />
                </BudgetField>
              </BudgetFormGrid>
              <button style={buttonStyle('primary')} type="submit">
                Create Family
              </button>
            </BudgetForm>

            <BudgetForm action={joinFamilyAction} title="Join Workspace">
              <BudgetFormGrid>
                <BudgetField label="Invite Code">
                  <BudgetInput name="invite_code" required />
                </BudgetField>
                <BudgetField label="Member Name">
                  <BudgetInput name="member_name" required />
                </BudgetField>
              </BudgetFormGrid>
              <button style={buttonStyle('secondary')} type="submit">
                Join Family
              </button>
            </BudgetForm>

            {snapshot.family ? (
              <BudgetForm action={addMemberAction} title="Add Member">
                <BudgetFormGrid>
                  <BudgetField label="Display Name">
                    <BudgetInput name="display_name" required />
                  </BudgetField>
                  <BudgetField label="Role">
                    <BudgetSelect defaultValue="member" name="role">
                      {['owner', 'admin', 'member', 'viewer'].map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </BudgetSelect>
                  </BudgetField>
                  <BudgetField label="Avatar Emoji">
                    <BudgetInput name="avatar_emoji" placeholder="🧾" />
                  </BudgetField>
                </BudgetFormGrid>
                <button style={buttonStyle('ghost')} type="submit">
                  Add Member
                </button>
              </BudgetForm>
            ) : null}
          </>
        }
      />
    </BudgetPage>
  );
}
