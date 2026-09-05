<script lang="ts">
	import { wizard, STEPS } from '$lib/stores/wizard';
	import WizardStepper from '$lib/components/WizardStepper.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="flex min-h-screen flex-col bg-zinc-950">
	<!-- Header -->
	<header class="border-b border-zinc-800/50">
		<div class="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-6 pb-2">
			<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-lg font-bold text-white">
				M
			</div>
			<div>
				<h1 class="text-lg font-semibold text-zinc-100">MyMail Setup</h1>
				<p class="text-xs text-zinc-500">Configure your private email server</p>
			</div>
		</div>
		<div class="mx-auto max-w-3xl">
			<WizardStepper currentStep={$wizard.currentStep} completedSteps={$wizard.completedSteps} />
		</div>
	</header>

	<!-- Main content -->
	<main class="flex-1">
		<div class="mx-auto max-w-2xl px-4 py-8">
			{@render children()}
		</div>
	</main>

	<!-- Footer -->
	<footer class="border-t border-zinc-800/50 py-4">
		<p class="text-center text-xs text-zinc-600">MyMail - Your private email server</p>
	</footer>
</div>
