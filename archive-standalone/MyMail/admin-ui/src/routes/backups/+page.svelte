<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { toasts } from '$lib/stores';
	import type { BackupData } from '$lib/types';

	interface Props {
		data: { backups: BackupData };
	}

	let { data }: Props = $props();

	let showRestoreModal = $state(false);
	let restoreTargetId = $state('');

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
		});
	}

	function formatBytes(bytes: number): string {
		const gb = bytes / 1e9;
		if (gb >= 1) return `${gb.toFixed(1)} GB`;
		return `${(bytes / 1e6).toFixed(0)} MB`;
	}

	function formatDuration(seconds: number): string {
		const min = Math.floor(seconds / 60);
		const sec = seconds % 60;
		return `${min}m ${sec}s`;
	}

	const historyColumns = [
		{
			key: 'date',
			label: 'Date',
			render: (val: unknown) => formatDate(val as string)
		},
		{
			key: 'size',
			label: 'Size',
			render: (val: unknown) => formatBytes(val as number)
		},
		{
			key: 'duration',
			label: 'Duration',
			render: (val: unknown) => formatDuration(val as number)
		},
		{
			key: 'status',
			label: 'Status',
			render: (val: unknown) => {
				const s = val as string;
				const colors: Record<string, string> = {
					completed: 'bg-green-500/15 text-green-400 border-green-500/30',
					failed: 'bg-red-500/15 text-red-400 border-red-500/30',
					in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/30'
				};
				return `<span class="inline-flex rounded border px-2 py-0.5 text-xs font-medium ${colors[s] ?? ''}">${s}</span>`;
			}
		}
	];

	function triggerBackup() {
		toasts.info('Backup started...');
		setTimeout(() => toasts.success('Backup completed'), 2000);
	}

	function confirmRestore() {
		toasts.info('Restoring from backup...');
		showRestoreModal = false;
		setTimeout(() => toasts.success('Restore completed'), 3000);
	}

	const last = data.backups.lastBackup;
	const totalStorage = data.backups.storageBreakdown.reduce((acc, a) => acc + a.size, 0);
</script>

<div class="space-y-6">
	<!-- Last backup card -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-lg font-semibold text-zinc-100">Last Backup</h2>
			<span class="inline-flex rounded border px-2 py-0.5 text-xs font-medium
				{last.status === 'completed'
					? 'bg-green-500/15 text-green-400 border-green-500/30'
					: 'bg-red-500/15 text-red-400 border-red-500/30'}">
				{last.status}
			</span>
		</div>
		<div class="grid grid-cols-3 gap-4 text-sm">
			<div>
				<p class="text-zinc-500">Date</p>
				<p class="font-medium text-zinc-200">{formatDate(last.date)}</p>
			</div>
			<div>
				<p class="text-zinc-500">Size</p>
				<p class="font-medium text-zinc-200">{formatBytes(last.size)}</p>
			</div>
			<div>
				<p class="text-zinc-500">Duration</p>
				<p class="font-medium text-zinc-200">{formatDuration(last.duration)}</p>
			</div>
		</div>
	</div>

	<!-- Actions -->
	<div class="flex gap-3">
		<button
			onclick={triggerBackup}
			class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
		>
			Trigger Manual Backup
		</button>
		<button
			onclick={() => (showRestoreModal = true)}
			class="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
		>
			Restore from Backup
		</button>
	</div>

	<!-- History table -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="mb-4 text-lg font-semibold text-zinc-100">Backup History</h2>
		<DataTable columns={historyColumns} data={data.backups.history} />
	</div>

	<!-- Storage breakdown -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="mb-4 text-lg font-semibold text-zinc-100">Storage Breakdown</h2>
		<div class="space-y-3">
			{#each data.backups.storageBreakdown as item}
				{@const pct = (item.size / totalStorage) * 100}
				<div>
					<div class="flex justify-between text-sm mb-1">
						<span class="text-zinc-300">{item.account}</span>
						<span class="text-zinc-500">{formatBytes(item.size)}</span>
					</div>
					<div class="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
						<div class="h-full rounded-full bg-blue-500" style="width: {pct}%"></div>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<!-- Restore Modal -->
<Modal
	open={showRestoreModal}
	title="Restore from Backup"
	onConfirm={confirmRestore}
	onCancel={() => (showRestoreModal = false)}
	confirmLabel="Restore"
	confirmDestructive
>
	<div class="space-y-3">
		<p class="text-sm text-zinc-300">
			This will restore all data from the selected backup. Current data will be overwritten.
		</p>
		<select
			bind:value={restoreTargetId}
			class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
		>
			{#each data.backups.history.filter(b => b.status === 'completed') as backup}
				<option value={backup.id}>{formatDate(backup.date)} - {formatBytes(backup.size)}</option>
			{/each}
		</select>
		<p class="text-xs text-red-400">This action cannot be undone.</p>
	</div>
</Modal>
