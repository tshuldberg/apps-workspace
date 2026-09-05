<script lang="ts">
	import { page } from '$app/stores';
	import { sidebarCollapsed } from '$lib/stores';

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
		{ href: '/domains', label: 'Domains', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9' },
		{ href: '/accounts', label: 'Accounts', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197V21' },
		{ href: '/stats', label: 'Statistics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
		{ href: '/spam', label: 'Spam Filter', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z' },
		{ href: '/backups', label: 'Backups', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
		{ href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
	];

	function isActive(href: string, pathname: string): boolean {
		return pathname.startsWith(href);
	}
</script>

<aside
	class="fixed left-0 top-0 z-40 h-screen transition-all duration-200 bg-zinc-900 border-r border-zinc-800
		{$sidebarCollapsed ? 'w-16' : 'w-60'}"
>
	<div class="flex h-full flex-col">
		<!-- Logo -->
		<div class="flex h-16 items-center gap-3 border-b border-zinc-800 px-4">
			<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500 font-bold text-white text-sm">
				M
			</div>
			{#if !$sidebarCollapsed}
				<span class="text-lg font-semibold text-zinc-100">MyMail</span>
			{/if}
		</div>

		<!-- Navigation -->
		<nav class="flex-1 space-y-1 p-3">
			{#each navItems as item}
				{@const active = isActive(item.href, $page.url.pathname)}
				<a
					href={item.href}
					class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
						{active
							? 'bg-blue-500/15 text-blue-400'
							: 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
				>
					<svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
					</svg>
					{#if !$sidebarCollapsed}
						<span>{item.label}</span>
					{/if}
				</a>
			{/each}
		</nav>

		<!-- Collapse toggle -->
		<div class="border-t border-zinc-800 p-3">
			<button
				onclick={() => sidebarCollapsed.update((v) => !v)}
				class="flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
			>
				<svg class="h-5 w-5 transition-transform {$sidebarCollapsed ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
				</svg>
			</button>
		</div>
	</div>
</aside>

<!-- Light mode overrides -->
<style>
	:global(html.light) aside {
		@apply bg-white border-zinc-200;
	}
	:global(html.light) aside .border-b,
	:global(html.light) aside .border-t {
		@apply border-zinc-200;
	}
</style>
