<script lang="ts">
	import { goto } from '$app/navigation';
	import { wizard } from '$lib/stores/wizard';
	import { onMount } from 'svelte';

	onMount(() => wizard.goTo(1));

	function getStarted() {
		wizard.next();
		goto('/setup/domain');
	}
</script>

<div class="space-y-8">
	<!-- Hero -->
	<div class="text-center">
		<div class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500 text-3xl font-bold text-white shadow-lg shadow-blue-500/20">
			M
		</div>
		<h2 class="text-2xl font-bold text-zinc-100">Set up your private email server</h2>
		<p class="mt-2 text-sm text-zinc-400">
			Follow this wizard to configure MyMail. You'll have a fully functional, self-hosted email server when you're done.
		</p>
	</div>

	<!-- What you'll need -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
		<h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">What you'll need</h3>
		<ul class="space-y-3">
			<li class="flex items-start gap-3">
				<div class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-400">
					<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</div>
				<div>
					<p class="text-sm font-medium text-zinc-200">A domain name</p>
					<p class="text-xs text-zinc-500">e.g., example.com - you'll need access to manage DNS records</p>
				</div>
			</li>
			<li class="flex items-start gap-3">
				<div class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-400">
					<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</div>
				<div>
					<p class="text-sm font-medium text-zinc-200">A VPS with a public IP address</p>
					<p class="text-xs text-zinc-500">Running this server with Docker - you should already have this</p>
				</div>
			</li>
			<li class="flex items-start gap-3">
				<div class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-500/15 text-yellow-400">
					<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01" />
					</svg>
				</div>
				<div>
					<p class="text-sm font-medium text-zinc-200">A relay service account <span class="text-xs text-zinc-500">(recommended)</span></p>
					<p class="text-xs text-zinc-500">Amazon SES, SendGrid, Mailgun, or Postmark for reliable delivery</p>
				</div>
			</li>
		</ul>
	</div>

	<!-- Estimated time -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
		<div class="flex items-center gap-3">
			<svg class="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<div>
				<p class="text-sm font-medium text-zinc-300">Estimated time: 15-30 minutes</p>
				<p class="text-xs text-zinc-500">DNS propagation may take additional time</p>
			</div>
		</div>
	</div>

	<!-- CTA -->
	<div class="flex justify-end">
		<button
			onclick={getStarted}
			class="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
		>
			Get Started
		</button>
	</div>
</div>
