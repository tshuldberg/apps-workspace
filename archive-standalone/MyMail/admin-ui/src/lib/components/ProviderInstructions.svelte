<script lang="ts">
	interface Props {
		provider: 'ses' | 'sendgrid' | 'mailgun' | 'postmark' | 'none' | '';
	}

	let { provider }: Props = $props();

	const instructions: Record<string, { title: string; steps: string[]; defaults: { host: string; port: number } }> = {
		ses: {
			title: 'Amazon SES Setup',
			steps: [
				'Sign in to the AWS Console and navigate to Amazon SES.',
				'Verify your domain identity under "Verified identities".',
				'If in sandbox mode, request production access under "Account dashboard".',
				'Create SMTP credentials under "SMTP settings" > "Create SMTP credentials".',
				'Copy the SMTP username and password (shown only once).',
				'Use the SMTP endpoint for your AWS region (e.g., email-smtp.us-east-1.amazonaws.com).'
			],
			defaults: { host: 'email-smtp.us-east-1.amazonaws.com', port: 587 }
		},
		sendgrid: {
			title: 'SendGrid Setup',
			steps: [
				'Sign up or log in at sendgrid.com.',
				'Go to "Settings" > "API Keys" and create a new API key with "Mail Send" permission.',
				'Use "apikey" as the SMTP username.',
				'Use your API key as the SMTP password.',
				'Verify your sender domain under "Settings" > "Sender Authentication".'
			],
			defaults: { host: 'smtp.sendgrid.net', port: 587 }
		},
		mailgun: {
			title: 'Mailgun Setup',
			steps: [
				'Sign up or log in at mailgun.com.',
				'Add and verify your domain under "Sending" > "Domains".',
				'Find your SMTP credentials on the domain settings page.',
				'The default SMTP username is postmaster@your-domain.com.',
				'Copy the SMTP password from the domain credentials section.'
			],
			defaults: { host: 'smtp.mailgun.org', port: 587 }
		},
		postmark: {
			title: 'Postmark Setup',
			steps: [
				'Sign up or log in at postmarkapp.com.',
				'Create a new server or use the default one.',
				'Find your server API token under "Server" > "API Tokens".',
				'Use the API token as both the SMTP username and password.',
				'Verify your sender signature or domain under "Sender Signatures".'
			],
			defaults: { host: 'smtp.postmarkapp.com', port: 587 }
		}
	};

	let info = $derived(provider && provider !== 'none' ? instructions[provider] : null);
</script>

{#if info}
	<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
		<h3 class="mb-3 text-sm font-semibold text-zinc-200">{info.title}</h3>
		<ol class="space-y-2">
			{#each info.steps as step, i}
				<li class="flex gap-3 text-sm text-zinc-400">
					<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-400">
						{i + 1}
					</span>
					<span>{step}</span>
				</li>
			{/each}
		</ol>
		<div class="mt-4 flex gap-4 rounded bg-zinc-950 px-4 py-2.5 text-xs">
			<span class="text-zinc-500">Default host: <span class="font-mono text-zinc-300">{info.defaults.host}</span></span>
			<span class="text-zinc-500">Port: <span class="font-mono text-zinc-300">{info.defaults.port}</span></span>
		</div>
	</div>
{/if}
