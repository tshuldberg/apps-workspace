<script lang="ts">
	import { goto } from '$app/navigation';
	import { wizard } from '$lib/stores/wizard';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import { onMount } from 'svelte';

	onMount(() => {
		wizard.goTo(7);
		wizard.completeStep(7);
		saveConfig();
	});

	let saving = $state(false);

	async function saveConfig() {
		saving = true;
		try {
			await fetch('/api/setup/save-config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify($wizard.data)
			});
		} catch {
			// Config save failed - non-blocking
		}
		saving = false;
	}

	let domain = $derived($wizard.data.domain || 'example.com');
	let hostname = $derived($wizard.data.hostname || 'mail.example.com');
	let adminEmail = $derived($wizard.data.adminEmail || 'admin@example.com');
	let relayProvider = $derived($wizard.data.relayProvider || 'none');

	const providerNames: Record<string, string> = {
		ses: 'Amazon SES',
		sendgrid: 'SendGrid',
		mailgun: 'Mailgun',
		postmark: 'Postmark',
		none: 'Direct Sending',
		'': 'Not configured'
	};

	function goToDashboard() {
		goto('/dashboard');
	}
</script>

<div class="space-y-8">
	<!-- Success animation -->
	<div class="text-center">
		<div class="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 success-ring">
			<svg class="h-10 w-10 text-green-400 success-check" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
			</svg>
		</div>
		<h2 class="text-2xl font-bold text-zinc-100">Setup Complete!</h2>
		<p class="mt-2 text-sm text-zinc-400">
			Your private email server is ready to use.
		</p>
	</div>

	<!-- Configuration summary -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
		<h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">Configuration Summary</h3>
		<dl class="space-y-3">
			<div class="flex justify-between">
				<dt class="text-sm text-zinc-500">Domain</dt>
				<dd class="text-sm font-medium text-zinc-200">{domain}</dd>
			</div>
			<div class="flex justify-between">
				<dt class="text-sm text-zinc-500">Email Address</dt>
				<dd class="text-sm font-medium text-zinc-200">{adminEmail}</dd>
			</div>
			<div class="flex justify-between">
				<dt class="text-sm text-zinc-500">Relay Provider</dt>
				<dd class="text-sm font-medium text-zinc-200">{providerNames[relayProvider]}</dd>
			</div>
		</dl>
	</div>

	<!-- Quick links -->
	<div class="grid gap-3 sm:grid-cols-2">
		<a
			href="https://{hostname}"
			target="_blank"
			rel="noopener noreferrer"
			class="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 transition-colors"
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
				</svg>
			</div>
			<div>
				<p class="text-sm font-medium text-zinc-200">Open Webmail</p>
				<p class="text-xs text-zinc-500">Access your inbox</p>
			</div>
		</a>
		<a
			href="/dashboard"
			class="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 transition-colors"
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
				</svg>
			</div>
			<div>
				<p class="text-sm font-medium text-zinc-200">Admin Dashboard</p>
				<p class="text-xs text-zinc-500">Manage your server</p>
			</div>
		</a>
	</div>

	<!-- Mail client settings -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
		<h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">Mail Client Settings</h3>
		<div class="space-y-4">
			<!-- IMAP -->
			<div class="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
				<div class="flex items-center justify-between mb-2">
					<h4 class="text-sm font-medium text-zinc-200">IMAP (Incoming)</h4>
					<span class="rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400">Receiving</span>
				</div>
				<div class="space-y-1.5 text-sm">
					<div class="flex items-center justify-between">
						<span class="text-zinc-500">Server</span>
						<div class="flex items-center gap-1">
							<span class="font-mono text-zinc-300">{hostname}</span>
							<CopyButton text={hostname} />
						</div>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-zinc-500">Port</span>
						<div class="flex items-center gap-1">
							<span class="font-mono text-zinc-300">993</span>
							<CopyButton text="993" />
						</div>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-zinc-500">Security</span>
						<span class="font-mono text-zinc-300">SSL/TLS</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-zinc-500">Username</span>
						<div class="flex items-center gap-1">
							<span class="font-mono text-zinc-300">{adminEmail}</span>
							<CopyButton text={adminEmail} />
						</div>
					</div>
				</div>
			</div>

			<!-- SMTP -->
			<div class="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
				<div class="flex items-center justify-between mb-2">
					<h4 class="text-sm font-medium text-zinc-200">SMTP (Outgoing)</h4>
					<span class="rounded bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-400">Sending</span>
				</div>
				<div class="space-y-1.5 text-sm">
					<div class="flex items-center justify-between">
						<span class="text-zinc-500">Server</span>
						<div class="flex items-center gap-1">
							<span class="font-mono text-zinc-300">{hostname}</span>
							<CopyButton text={hostname} />
						</div>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-zinc-500">Port</span>
						<div class="flex items-center gap-1">
							<span class="font-mono text-zinc-300">587</span>
							<CopyButton text="587" />
						</div>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-zinc-500">Security</span>
						<span class="font-mono text-zinc-300">STARTTLS</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-zinc-500">Username</span>
						<div class="flex items-center gap-1">
							<span class="font-mono text-zinc-300">{adminEmail}</span>
							<CopyButton text={adminEmail} />
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Next steps -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
		<h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">Next Steps</h3>
		<ul class="space-y-3">
			{#each [
				{ label: 'Set up mobile email client', desc: 'Use the IMAP/SMTP settings above' },
				{ label: 'Configure backup storage', desc: 'Set up automated backups in the admin dashboard' },
				{ label: 'Import existing email', desc: 'Migrate from your previous provider' },
				{ label: 'Tell your contacts your new address', desc: 'Update your email everywhere' }
			] as item}
				<li class="flex items-start gap-3">
					<div class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-800">
					</div>
					<div>
						<p class="text-sm font-medium text-zinc-200">{item.label}</p>
						<p class="text-xs text-zinc-500">{item.desc}</p>
					</div>
				</li>
			{/each}
		</ul>
	</div>

	<!-- CTA -->
	<div class="flex justify-center">
		<button
			onclick={goToDashboard}
			class="rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
		>
			Go to Dashboard
		</button>
	</div>
</div>

<style>
	.success-ring {
		animation: ring-pulse 1s ease-out;
	}

	.success-check {
		animation: check-draw 0.6s ease-out 0.3s both;
	}

	@keyframes ring-pulse {
		0% {
			transform: scale(0.8);
			opacity: 0;
		}
		50% {
			transform: scale(1.1);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	@keyframes check-draw {
		0% {
			opacity: 0;
			transform: scale(0.5);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
