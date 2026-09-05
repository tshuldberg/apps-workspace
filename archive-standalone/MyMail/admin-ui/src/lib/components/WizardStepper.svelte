<script lang="ts">
	import { STEPS } from '$lib/stores/wizard';

	interface Props {
		currentStep: number;
		completedSteps: Set<number>;
	}

	let { currentStep, completedSteps }: Props = $props();
</script>

<nav class="w-full px-4 py-6">
	<ol class="flex items-center justify-between">
		{#each STEPS as step, i}
			{@const isCompleted = completedSteps.has(step.number)}
			{@const isCurrent = step.number === currentStep}
			{@const isPast = step.number < currentStep}

			<li class="flex items-center {i < STEPS.length - 1 ? 'flex-1' : ''}">
				<div class="flex flex-col items-center gap-1.5">
					<!-- Step circle -->
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all
							{isCurrent
								? 'border-blue-500 bg-blue-500 text-white'
								: isCompleted || isPast
									? 'border-green-500 bg-green-500/15 text-green-400'
									: 'border-zinc-700 bg-zinc-900 text-zinc-500'}"
					>
						{#if isCompleted || isPast}
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						{:else}
							{step.number}
						{/if}
					</div>
					<!-- Label - hidden on small screens -->
					<span
						class="hidden text-xs font-medium sm:block
							{isCurrent
								? 'text-blue-400'
								: isCompleted || isPast
									? 'text-green-400'
									: 'text-zinc-500'}"
					>
						{step.label}
					</span>
				</div>

				<!-- Connector line -->
				{#if i < STEPS.length - 1}
					<div
						class="mx-2 mt-[-1.125rem] h-0.5 flex-1 sm:mt-[-0.875rem]
							{isPast || isCompleted ? 'bg-green-500/40' : 'bg-zinc-800'}"
					></div>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
