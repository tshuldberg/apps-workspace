<script lang="ts">
	interface Props {
		text: string;
	}

	let { text }: Props = $props();
	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Fallback for non-secure contexts
			const textarea = document.createElement('textarea');
			textarea.value = text;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		}
	}
</script>

<button
	onclick={copy}
	class="shrink-0 rounded-lg p-1.5 transition-colors
		{copied
			? 'text-green-400 bg-green-500/10'
			: 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}"
	title={copied ? 'Copied!' : 'Copy to clipboard'}
>
	{#if copied}
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
		</svg>
	{:else}
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
		</svg>
	{/if}
</button>
