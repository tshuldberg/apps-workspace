<script lang="ts">
	import { goto } from '$app/navigation';
	import { toasts } from '$lib/stores';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		error = '';

		try {
			// TODO: Replace with real Stalwart auth
			if (email === 'admin@example.com' && password === 'admin') {
				document.cookie = 'session=mock-token; path=/; max-age=86400';
				toasts.success('Logged in successfully');
				goto('/dashboard');
			} else {
				error = 'Invalid email or password';
			}
		} catch (err) {
			error = 'Login failed. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
	<div class="w-full max-w-sm">
		<!-- Logo -->
		<div class="mb-8 text-center">
			<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500 text-2xl font-bold text-white">
				M
			</div>
			<h1 class="text-2xl font-bold text-zinc-100">MyMail Admin</h1>
			<p class="mt-1 text-sm text-zinc-500">Sign in to manage your mail server</p>
		</div>

		<!-- Login form -->
		<form onsubmit={handleSubmit} class="space-y-4">
			{#if error}
				<div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
					{error}
				</div>
			{/if}

			<div>
				<label for="email" class="mb-1.5 block text-sm font-medium text-zinc-300">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					required
					placeholder="admin@example.com"
					class="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
				/>
			</div>

			<div>
				<label for="password" class="mb-1.5 block text-sm font-medium text-zinc-300">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					required
					placeholder="Enter your password"
					class="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
				/>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{loading ? 'Signing in...' : 'Sign in'}
			</button>
		</form>

		<p class="mt-6 text-center text-xs text-zinc-600">
			Default: admin@example.com / admin
		</p>
	</div>
</div>
