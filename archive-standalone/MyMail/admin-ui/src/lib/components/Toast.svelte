<script lang="ts">
	import { toasts } from '$lib/stores';

	const typeStyles = {
		success: 'border-green-500/30 bg-green-500/10 text-green-400',
		error: 'border-red-500/30 bg-red-500/10 text-red-400',
		warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
		info: 'border-blue-500/30 bg-blue-500/10 text-blue-400'
	};

	const typeIcons = {
		success: 'M5 13l4 4L19 7',
		error: 'M6 18L18 6M6 6l12 12',
		warning: 'M12 9v2m0 4h.01M12 3l9.5 16.5H2.5L12 3z',
		info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
	};
</script>

<div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
	{#each $toasts as toast (toast.id)}
		<div
			class="flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur {typeStyles[toast.type]}"
			role="alert"
		>
			<svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d={typeIcons[toast.type]} />
			</svg>
			<p class="text-sm">{toast.message}</p>
			<button
				onclick={() => toasts.remove(toast.id)}
				class="ml-2 shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/each}
</div>
