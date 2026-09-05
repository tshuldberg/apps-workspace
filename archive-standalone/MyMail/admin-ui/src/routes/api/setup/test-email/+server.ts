import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const to = (body as Record<string, string>).to ?? 'test@example.com';

	// TODO: Replace with real email sending via Stalwart's SMTP/API
	// Then check SPF/DKIM/DMARC results from the delivery report

	// Simulate sending delay
	await new Promise((r) => setTimeout(r, 1500));

	return json({
		sent: true,
		to,
		spf: 'pass',
		dkim: 'pass',
		dmarc: 'pass',
		spamPrediction: 'inbox'
	});
};
