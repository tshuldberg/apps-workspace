<script lang="ts">
	interface Column {
		key: string;
		label: string;
		sortable?: boolean;
		render?: (value: unknown, row: Record<string, unknown>) => string;
	}

	interface Props {
		columns: Column[];
		data: Record<string, unknown>[];
		onRowClick?: (row: Record<string, unknown>) => void;
	}

	let { columns, data, onRowClick }: Props = $props();

	let sortKey = $state('');
	let sortAsc = $state(true);

	function sort(key: string) {
		if (sortKey === key) {
			sortAsc = !sortAsc;
		} else {
			sortKey = key;
			sortAsc = true;
		}
	}

	let sortedData = $derived.by(() => {
		if (!sortKey) return data;
		return [...data].sort((a, b) => {
			const av = a[sortKey];
			const bv = b[sortKey];
			if (av == null && bv == null) return 0;
			if (av == null) return 1;
			if (bv == null) return -1;
			if (typeof av === 'number' && typeof bv === 'number') {
				return sortAsc ? av - bv : bv - av;
			}
			const as = String(av);
			const bs = String(bv);
			return sortAsc ? as.localeCompare(bs) : bs.localeCompare(as);
		});
	});

	function getCellValue(col: Column, row: Record<string, unknown>): string {
		if (col.render) return col.render(row[col.key], row);
		return String(row[col.key] ?? '');
	}
</script>

<div class="overflow-x-auto rounded-xl border border-zinc-800">
	<table class="w-full text-sm">
		<thead>
			<tr class="border-b border-zinc-800 bg-zinc-900/50">
				{#each columns as col}
					<th class="px-4 py-3 text-left font-medium text-zinc-400">
						{#if col.sortable !== false}
							<button
								class="flex items-center gap-1 hover:text-zinc-200 transition-colors"
								onclick={() => sort(col.key)}
							>
								{col.label}
								{#if sortKey === col.key}
									<span class="text-blue-400">{sortAsc ? '\u2191' : '\u2193'}</span>
								{/if}
							</button>
						{:else}
							{col.label}
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each sortedData as row, i}
				<tr
					class="border-b border-zinc-800/50 transition-colors
						{onRowClick ? 'cursor-pointer hover:bg-zinc-800/50' : ''}
						{i % 2 === 0 ? 'bg-zinc-900/30' : ''}"
					onclick={() => onRowClick?.(row)}
				>
					{#each columns as col}
						<td class="px-4 py-3 text-zinc-300">
							{@html getCellValue(col, row)}
						</td>
					{/each}
				</tr>
			{/each}
			{#if sortedData.length === 0}
				<tr>
					<td colspan={columns.length} class="px-4 py-8 text-center text-zinc-500">
						No data available
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</div>
