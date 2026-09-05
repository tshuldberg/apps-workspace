<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { wizard } from '$lib/stores/wizard';

	onMount(() => {
		wizard.goTo(1);
		goto('/setup/welcome', { replaceState: true });
	});
</script>

<div class="flex items-center justify-center py-16">
	<p class="text-sm text-zinc-500">Redirecting to setup wizard...</p>
</div>
