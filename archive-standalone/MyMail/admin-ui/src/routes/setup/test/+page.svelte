<script lang="ts">
	import { goto } from '$app/navigation';
	import { wizard } from '$lib/stores/wizard';
	import { onMount } from 'svelte';

	onMount(() => wizard.goTo(6));

	let testEmail = $state('');
	let sending = $state(false);
	let testResult = $state<null | {
		sent: boolean;
		spf: 'pass' | 'fail' | 'none';
		dkim: 'pass' | 'fail' | 'none';
		dmarc: 'pass' | 'fail' | 'none';
		spamPrediction: 'inbox' | 'spam' | 'unknown';
	}>(null);

	async function sendTest() {
		if (!testEmail) return;
		sending = true;
		testResult = null;

		try {
			const res = await fetch('/api/setup/test-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ to: testEmail })
			});

			const data = await res.json();
			testResult = data;
		} catch {
			testResult = {
				sent: false,
				spf: 'none',
				dkim: 'none',
				dmarc: 'none',
				spamPrediction: 'unknown'
			};
		}

		sending = false;
	}

	function sendAnother() {
		testResult = null;
		testEmail = '';
	}

	function goBack() {
		wizard.prev();
		goto('/setup/account');
	}

	function goNext() {
		wizard.next();
		goto('/setup/complete');
	}

	const checkIcons: Record<string, { icon: string; color: string }> = {
		pass: { icon: 'M5 13l4 4L19 7', color: 'text-green-400 bg-green-500/10' },
		fail: { icon: 'M6 18L18 6M6 6l12 12', color: 'text-red-400 bg-red-500/10' },
		none: { icon: 'M12 8v4m0 4h.01', color: 'text-zinc-500 bg-zinc-800' }
	};
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-xl font-bold text-zinc-100">Test Your Email</h2>
		<p class="mt-1 text-sm text-zinc-400">Send a test email to verify everything is working correctly. Use an external email address (Gmail, Outlook, etc.) for the best test.</p>
	</div>

	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
		{#if !testResult}
			<!-- Send test form -->
			<div>
				<label for="test-email" class="mb-1.5 block text-sm font-medium text-zinc-300">Send test email to</label>
				<div class="flex gap-3">
					<input
						id="test-email"
						type="email"
						bind:value={testEmail}
						placeholder="yourname@gmail.com"
						class="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
					<button
						onclick={sendTest}
						disabled={sending || !testEmail}
						class="shrink-0 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
					>
						{sending ? 'Sending...' : 'Send Test Email'}
					</button>
				</div>
				<p class="mt-1 text-xs text-zinc-600">
					Sends from {$wizard.data.adminEmail || 'admin@' + ($wizard.data.domain || 'example.com')}
				</p>
			</div>
		{:else}
			<!-- Test results -->
			<div class="space-y-4">
				<!-- Send status -->
				<div class="flex items-center gap-3 rounded-lg border px-4 py-3
					{testResult.sent ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}">
					<svg class="h-5 w-5 {testResult.sent ? 'text-green-400' : 'text-red-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d={testResult.sent ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12'} />
					</svg>
					<div>
						<p class="text-sm font-medium {testResult.sent ? 'text-green-400' : 'text-red-400'}">
							{testResult.sent ? 'Email sent successfully' : 'Failed to send email'}
						</p>
						<p class="text-xs {testResult.sent ? 'text-green-400/60' : 'text-red-400/60'}">
							{testResult.sent ? `Sent to ${testEmail}` : 'Check your relay configuration'}
						</p>
					</div>
				</div>

				<!-- Authentication checks -->
				<div class="space-y-2">
					<h4 class="text-sm font-medium text-zinc-300">Authentication Checks</h4>

					{#each [
						{ label: 'SPF', value: testResult.spf, description: 'Sender Policy Framework' },
						{ label: 'DKIM', value: testResult.dkim, description: 'DomainKeys Identified Mail' },
						{ label: 'DMARC', value: testResult.dmarc, description: 'Domain-based Message Authentication' }
					] as check}
						<div class="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5">
							<div class="flex h-7 w-7 items-center justify-center rounded-full {checkIcons[check.value].color}">
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d={checkIcons[check.value].icon} />
								</svg>
							</div>
							<div class="flex-1">
								<p class="text-sm font-medium text-zinc-200">{check.label}</p>
								<p class="text-xs text-zinc-500">{check.description}</p>
							</div>
							<span class="text-xs font-medium uppercase
								{check.value === 'pass' ? 'text-green-400' : check.value === 'fail' ? 'text-red-400' : 'text-zinc-500'}">
								{check.value}
							</span>
						</div>
					{/each}
				</div>

				<!-- Inbox prediction -->
				<div class="rounded-lg border px-4 py-3
					{testResult.spamPrediction === 'inbox'
						? 'border-green-500/20 bg-green-500/5'
						: testResult.spamPrediction === 'spam'
							? 'border-red-500/20 bg-red-500/5'
							: 'border-zinc-800 bg-zinc-900/50'}">
					<p class="text-sm font-medium
						{testResult.spamPrediction === 'inbox' ? 'text-green-400' :
						 testResult.spamPrediction === 'spam' ? 'text-red-400' : 'text-zinc-400'}">
						{testResult.spamPrediction === 'inbox' ? 'Likely to land in inbox' :
						 testResult.spamPrediction === 'spam' ? 'May land in spam folder' :
						 'Unable to predict delivery'}
					</p>
					<p class="text-xs text-zinc-500">Based on authentication results</p>
				</div>

				<!-- Send another -->
				<button
					onclick={sendAnother}
					class="text-sm text-blue-400 hover:text-blue-300 transition-colors"
				>
					Send another test
				</button>
			</div>
		{/if}
	</div>

	<!-- Navigation -->
	<div class="flex justify-between">
		<button
			onclick={goBack}
			class="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
		>
			Back
		</button>
		<button
			onclick={goNext}
			class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
		>
			Continue
		</button>
	</div>
</div>
