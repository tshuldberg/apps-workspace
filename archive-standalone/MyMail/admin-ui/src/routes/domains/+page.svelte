<script lang="ts">
	import DnsRecordDisplay from '$lib/components/DnsRecordDisplay.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { toasts } from '$lib/stores';
	import type { Domain } from '$lib/types';

	interface Props {
		data: { domains: Domain[] };
	}

	let { data }: Props = $props();

	let expandedDomain = $state<string | null>(null);
	let showAddModal = $state(false);
	let newDomainName = $state('');

	function toggleExpand(id: string) {
		expandedDomain = expandedDomain === id ? null : id;
	}

	function addDomain() {
		if (!newDomainName.trim()) return;
		toasts.success(`Domain ${newDomainName} added`);
		newDomainName = '';
		showAddModal = false;
	}

	function validateDns(domain: Domain) {
		toasts.info(`Validating DNS for ${domain.name}...`);
		setTimeout(() => {
			if (domain.dnsVerified) {
				toasts.success(`All DNS records verified for ${domain.name}`);
			} else {
				toasts.warning(`Some DNS records are not yet configured for ${domain.name}`);
			}
		}, 1000);
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<p class="text-sm text-zinc-400">{data.domains.length} domain{data.domains.length !== 1 ? 's' : ''} configured</p>
		<button
			onclick={() => (showAddModal = true)}
			class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
		>
			Add Domain
		</button>
	</div>

	<!-- Domain list -->
	<div class="space-y-3">
		{#each data.domains as domain}
			<div class="rounded-xl border border-zinc-800 bg-zinc-900">
				<!-- Domain header -->
				<button
					onclick={() => toggleExpand(domain.id)}
					class="flex w-full items-center justify-between px-5 py-4 text-left"
				>
					<div class="flex items-center gap-3">
						<span class="flex h-8 w-8 items-center justify-center rounded-lg {domain.dnsVerified ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'}">
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
								{#if domain.dnsVerified}
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
								{:else}
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01" />
								{/if}
							</svg>
						</span>
						<div>
							<span class="text-sm font-semibold text-zinc-100">{domain.name}</span>
							<span class="ml-2 text-xs {domain.dnsVerified ? 'text-green-400' : 'text-yellow-400'}">
								{domain.dnsVerified ? 'Verified' : 'Pending verification'}
							</span>
						</div>
					</div>
					<svg class="h-5 w-5 text-zinc-500 transition-transform {expandedDomain === domain.id ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				<!-- DNS Records (expanded) -->
				{#if expandedDomain === domain.id}
					<div class="border-t border-zinc-800 px-5 py-4 space-y-3">
						<div class="flex items-center justify-between mb-2">
							<h3 class="text-sm font-medium text-zinc-300">DNS Records</h3>
							<button
								onclick={() => validateDns(domain)}
								class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
							>
								Validate DNS
							</button>
						</div>
						<DnsRecordDisplay {...domain.mxRecord} />
						<DnsRecordDisplay {...domain.spfRecord} />
						<DnsRecordDisplay {...domain.dkimRecord} />
						<DnsRecordDisplay {...domain.dmarcRecord} />
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<!-- Add Domain Modal -->
<Modal
	open={showAddModal}
	title="Add Domain"
	onConfirm={addDomain}
	onCancel={() => (showAddModal = false)}
	confirmLabel="Add Domain"
>
	<div>
		<label for="domain-name" class="mb-1.5 block text-sm font-medium text-zinc-300">Domain Name</label>
		<input
			id="domain-name"
			type="text"
			bind:value={newDomainName}
			placeholder="example.com"
			class="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
		/>
		<p class="mt-2 text-xs text-zinc-500">After adding, you will need to configure the DNS records shown.</p>
	</div>
</Modal>
