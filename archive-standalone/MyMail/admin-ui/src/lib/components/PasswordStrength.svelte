<script lang="ts">
	interface Props {
		password: string;
	}

	let { password }: Props = $props();

	let strength = $derived.by(() => {
		if (!password) return 0;
		let score = 0;
		if (password.length >= 8) score++;
		if (password.length >= 12) score++;
		if (/[A-Z]/.test(password)) score++;
		if (/[0-9]/.test(password)) score++;
		if (/[^A-Za-z0-9]/.test(password)) score++;
		return Math.min(score, 5);
	});

	const labels = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
	const colors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
	const textColors = ['', 'text-red-400', 'text-orange-400', 'text-yellow-400', 'text-blue-400', 'text-green-400'];
</script>

{#if password}
	<div class="space-y-1">
		<div class="flex gap-1">
			{#each { length: 5 } as _, i}
				<div class="h-1.5 flex-1 rounded-full {i < strength ? colors[strength] : 'bg-zinc-700'} transition-colors"></div>
			{/each}
		</div>
		<p class="text-xs {textColors[strength]}">{labels[strength]}</p>
	</div>
{/if}
