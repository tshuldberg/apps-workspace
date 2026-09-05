<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import PasswordStrength from '$lib/components/PasswordStrength.svelte';
	import { toasts } from '$lib/stores';
	import type { Account } from '$lib/types';

	interface Props {
		data: { accounts: Account[] };
	}

	let { data }: Props = $props();

	let showCreateModal = $state(false);
	let showDeleteModal = $state(false);
	let deleteTarget = $state<Account | null>(null);

	let newEmail = $state('');
	let newDisplayName = $state('');
	let newPassword = $state('');
	let newStorageLimit = $state(2);

	function formatBytes(bytes: number): string {
		const gb = bytes / 1e9;
		if (gb >= 1) return `${gb.toFixed(1)} GB`;
		return `${(bytes / 1e6).toFixed(0)} MB`;
	}

	const columns = [
		{ key: 'email', label: 'Email' },
		{ key: 'displayName', label: 'Display Name' },
		{
			key: 'storageUsed',
			label: 'Storage',
			render: (val: unknown, row: Record<string, unknown>) => {
				const used = val as number;
				const limit = row.storageLimit as number;
				const pct = ((used / limit) * 100).toFixed(0);
				const barColor = used / limit > 0.9 ? 'bg-red-500' : used / limit > 0.7 ? 'bg-yellow-500' : 'bg-blue-500';
				return `<div class="flex items-center gap-2">
					<div class="w-20 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
						<div class="h-full ${barColor} rounded-full" style="width: ${pct}%"></div>
					</div>
					<span class="text-xs text-zinc-500">${formatBytes(used)} / ${formatBytes(limit)}</span>
				</div>`;
			}
		},
		{
			key: 'status',
			label: 'Status',
			render: (val: unknown) => {
				const s = val as string;
				const colors: Record<string, string> = {
					active: 'bg-green-500/15 text-green-400 border-green-500/30',
					disabled: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
					suspended: 'bg-red-500/15 text-red-400 border-red-500/30'
				};
				return `<span class="inline-flex rounded border px-2 py-0.5 text-xs font-medium ${colors[s] ?? ''}">${s}</span>`;
			}
		},
		{
			key: 'id',
			label: 'Actions',
			sortable: false,
			render: (_val: unknown, row: Record<string, unknown>) => {
				return `<div class="flex gap-2">
					<button class="text-xs text-blue-400 hover:text-blue-300" data-action="edit" data-id="${row.id}">Edit</button>
					<button class="text-xs text-red-400 hover:text-red-300" data-action="delete" data-id="${row.id}">Delete</button>
				</div>`;
			}
		}
	];

	function handleRowClick(row: Record<string, unknown>) {
		// Could navigate to account detail
	}

	function createAccount() {
		if (!newEmail.trim() || !newPassword.trim()) return;
		toasts.success(`Account ${newEmail} created`);
		showCreateModal = false;
		newEmail = '';
		newDisplayName = '';
		newPassword = '';
		newStorageLimit = 2;
	}

	function confirmDelete() {
		if (deleteTarget) {
			toasts.success(`Account ${deleteTarget.email} deleted`);
			deleteTarget = null;
			showDeleteModal = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<p class="text-sm text-zinc-400">{data.accounts.length} account{data.accounts.length !== 1 ? 's' : ''}</p>
		<button
			onclick={() => (showCreateModal = true)}
			class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
		>
			Create Account
		</button>
	</div>

	<DataTable {columns} data={data.accounts} onRowClick={handleRowClick} />
</div>

<!-- Create Account Modal -->
<Modal
	open={showCreateModal}
	title="Create Account"
	onConfirm={createAccount}
	onCancel={() => (showCreateModal = false)}
	confirmLabel="Create"
>
	<div class="space-y-4">
		<div>
			<label for="new-email" class="mb-1.5 block text-sm font-medium text-zinc-300">Email</label>
			<input
				id="new-email"
				type="email"
				bind:value={newEmail}
				placeholder="user@example.com"
				class="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			/>
		</div>
		<div>
			<label for="new-name" class="mb-1.5 block text-sm font-medium text-zinc-300">Display Name</label>
			<input
				id="new-name"
				type="text"
				bind:value={newDisplayName}
				placeholder="John Doe"
				class="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			/>
		</div>
		<div>
			<label for="new-password" class="mb-1.5 block text-sm font-medium text-zinc-300">Password</label>
			<input
				id="new-password"
				type="password"
				bind:value={newPassword}
				placeholder="Strong password"
				class="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			/>
			<div class="mt-2">
				<PasswordStrength password={newPassword} />
			</div>
		</div>
		<div>
			<label for="storage-limit" class="mb-1.5 block text-sm font-medium text-zinc-300">Storage Limit (GB)</label>
			<input
				id="storage-limit"
				type="number"
				bind:value={newStorageLimit}
				min="1"
				max="50"
				class="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			/>
		</div>
	</div>
</Modal>

<!-- Delete Confirmation Modal -->
<Modal
	open={showDeleteModal}
	title="Delete Account"
	onConfirm={confirmDelete}
	onCancel={() => (showDeleteModal = false)}
	confirmLabel="Delete"
	confirmDestructive
>
	<p class="text-sm text-zinc-300">
		Are you sure you want to delete <strong>{deleteTarget?.email}</strong>? This action cannot be undone and all emails will be permanently removed.
	</p>
</Modal>
