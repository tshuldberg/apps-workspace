<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		onConfirm?: () => void;
		onCancel: () => void;
		confirmLabel?: string;
		confirmDestructive?: boolean;
		children: Snippet;
	}

	let { open, title, onConfirm, onCancel, confirmLabel = 'Confirm', confirmDestructive = false, children }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onCancel();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		onkeydown={handleKeydown}
	>
		<!-- Backdrop -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick={onCancel}></div>

		<!-- Content -->
		<div class="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
			<div class="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
				<h2 class="text-lg font-semibold text-zinc-100">{title}</h2>
				<button
					onclick={onCancel}
					class="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="px-6 py-4">
				{@render children()}
			</div>

			{#if onConfirm}
				<div class="flex justify-end gap-3 border-t border-zinc-800 px-6 py-4">
					<button
						onclick={onCancel}
						class="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
					>
						Cancel
					</button>
					<button
						onclick={onConfirm}
						class="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors
							{confirmDestructive
								? 'bg-red-600 hover:bg-red-700'
								: 'bg-blue-600 hover:bg-blue-700'}"
					>
						{confirmLabel}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	:global(html.light) .bg-zinc-900 {
		@apply bg-white;
	}
</style>
