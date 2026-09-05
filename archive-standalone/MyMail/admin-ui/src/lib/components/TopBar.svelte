<script lang="ts">
	import { theme, health, sidebarCollapsed } from '$lib/stores';

	interface Props {
		title: string;
	}

	let { title }: Props = $props();

	function statusColor(status: string | undefined): string {
		switch (status) {
			case 'ok': return 'bg-green-500';
			case 'warning': return 'bg-yellow-500';
			case 'error': return 'bg-red-500';
			default: return 'bg-zinc-500';
		}
	}
</script>

<header
	class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950/80 backdrop-blur px-6 transition-all duration-200"
	style="margin-left: {$sidebarCollapsed ? '4rem' : '15rem'}"
>
	<div class="flex items-center gap-3">
		<!-- Mobile menu button -->
		<button
			class="lg:hidden rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
			onclick={() => sidebarCollapsed.update((v) => !v)}
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
			</svg>
		</button>

		<h1 class="text-xl font-semibold text-zinc-100">{title}</h1>
	</div>

	<div class="flex items-center gap-4">
		<!-- System status -->
		<div class="flex items-center gap-2 text-sm text-zinc-400">
			<span class="relative flex h-2.5 w-2.5">
				<span class="animate-ping absolute inline-flex h-full w-full rounded-full {statusColor($health?.status)} opacity-75"></span>
				<span class="relative inline-flex rounded-full h-2.5 w-2.5 {statusColor($health?.status)}"></span>
			</span>
			<span class="hidden sm:inline">
				{$health?.status === 'ok' ? 'All systems operational' : $health?.status === 'warning' ? 'Degraded' : 'Issues detected'}
			</span>
		</div>

		<!-- Theme toggle -->
		<button
			onclick={() => theme.toggle()}
			class="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
			title="Toggle theme"
		>
			{#if $theme === 'dark'}
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
				</svg>
			{:else}
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
				</svg>
			{/if}
		</button>

		<!-- Logout -->
		<a
			href="/login"
			class="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors"
			title="Logout"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
			</svg>
		</a>
	</div>
</header>

<style>
	:global(html.light) header {
		@apply bg-white/80 border-zinc-200;
	}
	:global(html.light) header h1 {
		@apply text-zinc-900;
	}
</style>
