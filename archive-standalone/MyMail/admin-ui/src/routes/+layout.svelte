<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { theme, health, sidebarCollapsed } from '$lib/stores';
	import SidebarNav from '$lib/components/SidebarNav.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		data: { isAuthenticated: boolean; isPublicPath: boolean; pathname: string };
		children: Snippet;
	}

	let { data, children }: Props = $props();

	const pageTitles: Record<string, string> = {
		'/dashboard': 'Dashboard',
		'/domains': 'Domains',
		'/accounts': 'Accounts',
		'/stats': 'Statistics',
		'/spam': 'Spam Filter',
		'/backups': 'Backups',
		'/settings': 'Settings'
	};

	let currentTitle = $derived(
		Object.entries(pageTitles).find(([path]) => $page.url.pathname.startsWith(path))?.[1] ?? 'MyMail'
	);

	let showChrome = $derived(
		!$page.url.pathname.startsWith('/login') && !$page.url.pathname.startsWith('/setup')
	);

	onMount(() => {
		theme.init();

		// Poll health every 30 seconds
		async function fetchHealth() {
			try {
				const res = await fetch('/api/health');
				if (res.ok) health.set(await res.json());
			} catch {
				// Silently fail, status dot will show unknown
			}
		}
		fetchHealth();
		const interval = setInterval(fetchHealth, 30000);
		return () => clearInterval(interval);
	});
</script>

{#if showChrome}
	<SidebarNav />
	<TopBar title={currentTitle} />
	<main
		class="min-h-screen pt-16 transition-all duration-200"
		style="margin-left: {$sidebarCollapsed ? '4rem' : '15rem'}"
	>
		<div class="p-6">
			{@render children()}
		</div>
	</main>
{:else}
	{@render children()}
{/if}

<Toast />
