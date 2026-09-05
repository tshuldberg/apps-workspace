<script lang="ts">
	import { goto } from '$app/navigation';
	import { wizard } from '$lib/stores/wizard';
	import PasswordStrength from '$lib/components/PasswordStrength.svelte';
	import { onMount } from 'svelte';

	onMount(() => wizard.goTo(5));

	let emailPrefix = $state($wizard.data.adminEmail ? $wizard.data.adminEmail.split('@')[0] : '');
	let displayName = $state($wizard.data.adminDisplayName);
	let password = $state($wizard.data.adminPassword);
	let confirmPassword = $state('');

	let emailError = $state('');
	let passwordError = $state('');
	let confirmError = $state('');

	let domain = $derived($wizard.data.domain || 'example.com');
	let fullEmail = $derived(emailPrefix ? `${emailPrefix}@${domain}` : '');

	function validate(): boolean {
		let valid = true;

		if (!emailPrefix) {
			emailError = 'Email address is required';
			valid = false;
		} else if (!/^[a-zA-Z0-9._-]+$/.test(emailPrefix)) {
			emailError = 'Email prefix can only contain letters, numbers, dots, hyphens, and underscores';
			valid = false;
		} else {
			emailError = '';
		}

		if (!password) {
			passwordError = 'Password is required';
			valid = false;
		} else if (password.length < 8) {
			passwordError = 'Password must be at least 8 characters';
			valid = false;
		} else {
			passwordError = '';
		}

		if (password !== confirmPassword) {
			confirmError = 'Passwords do not match';
			valid = false;
		} else {
			confirmError = '';
		}

		return valid;
	}

	function goBack() {
		wizard.updateData({ adminEmail: fullEmail, adminPassword: password, adminDisplayName: displayName });
		wizard.prev();
		goto('/setup/relay');
	}

	function goNext() {
		if (!validate()) return;
		wizard.updateData({ adminEmail: fullEmail, adminPassword: password, adminDisplayName: displayName });
		wizard.next();
		goto('/setup/test');
	}

	// Password requirements
	let requirements = $derived([
		{ label: 'At least 8 characters', met: password.length >= 8 },
		{ label: 'Uppercase letter', met: /[A-Z]/.test(password) },
		{ label: 'Lowercase letter', met: /[a-z]/.test(password) },
		{ label: 'Number', met: /[0-9]/.test(password) },
		{ label: 'Special character', met: /[^A-Za-z0-9]/.test(password) }
	]);
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-xl font-bold text-zinc-100">Admin Account</h2>
		<p class="mt-1 text-sm text-zinc-400">Create your first email account. This will be the admin account for managing your mail server.</p>
	</div>

	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
		<!-- Email -->
		<div>
			<label for="email-prefix" class="mb-1.5 block text-sm font-medium text-zinc-300">Email Address</label>
			<div class="flex">
				<input
					id="email-prefix"
					type="text"
					bind:value={emailPrefix}
					oninput={() => (emailError = '')}
					placeholder="admin"
					class="flex-1 rounded-l-lg border bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 transition-colors
						{emailError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-zinc-800 focus:border-blue-500 focus:ring-blue-500'}"
				/>
				<span class="inline-flex items-center rounded-r-lg border border-l-0 border-zinc-800 bg-zinc-800 px-4 text-sm text-zinc-400">
					@{domain}
				</span>
			</div>
			{#if emailError}
				<p class="mt-1 text-xs text-red-400">{emailError}</p>
			{/if}
		</div>

		<!-- Display Name -->
		<div>
			<label for="display-name" class="mb-1.5 block text-sm font-medium text-zinc-300">Display Name</label>
			<input
				id="display-name"
				type="text"
				bind:value={displayName}
				placeholder="John Doe"
				class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			/>
			<p class="mt-1 text-xs text-zinc-600">The name shown in outgoing emails</p>
		</div>

		<!-- Password -->
		<div>
			<label for="admin-password" class="mb-1.5 block text-sm font-medium text-zinc-300">Password</label>
			<input
				id="admin-password"
				type="password"
				bind:value={password}
				oninput={() => (passwordError = '')}
				placeholder="Choose a strong password"
				class="w-full rounded-lg border bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 transition-colors
					{passwordError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-zinc-800 focus:border-blue-500 focus:ring-blue-500'}"
			/>
			{#if passwordError}
				<p class="mt-1 text-xs text-red-400">{passwordError}</p>
			{/if}
			<div class="mt-2">
				<PasswordStrength {password} />
			</div>

			<!-- Requirements -->
			<div class="mt-3 grid grid-cols-2 gap-1.5">
				{#each requirements as req}
					<div class="flex items-center gap-1.5">
						{#if req.met}
							<svg class="h-3.5 w-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						{:else}
							<svg class="h-3.5 w-3.5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
							</svg>
						{/if}
						<span class="text-xs {req.met ? 'text-zinc-400' : 'text-zinc-600'}">{req.label}</span>
					</div>
				{/each}
			</div>
		</div>

		<!-- Confirm Password -->
		<div>
			<label for="confirm-password" class="mb-1.5 block text-sm font-medium text-zinc-300">Confirm Password</label>
			<input
				id="confirm-password"
				type="password"
				bind:value={confirmPassword}
				oninput={() => (confirmError = '')}
				placeholder="Re-enter your password"
				class="w-full rounded-lg border bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 transition-colors
					{confirmError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-zinc-800 focus:border-blue-500 focus:ring-blue-500'}"
			/>
			{#if confirmError}
				<p class="mt-1 text-xs text-red-400">{confirmError}</p>
			{/if}
		</div>
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
