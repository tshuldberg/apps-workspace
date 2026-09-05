import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	// TODO: Replace with real Rspamd API
	return json({
		sensitivity: 7,
		quarantine: [
			{
				id: '1',
				from: 'spam@malicious.xyz',
				to: 'admin@example.com',
				subject: 'You have won $1,000,000!!!',
				score: 15.2,
				receivedAt: '2025-03-14T08:12:00Z'
			},
			{
				id: '2',
				from: 'offers@marketing-blast.com',
				to: 'alice@example.com',
				subject: 'Limited time offer - Act now!',
				score: 9.8,
				receivedAt: '2025-03-14T07:45:00Z'
			}
		],
		whitelist: ['newsletter@trusted.com', 'updates@github.com'],
		blacklist: ['spam@malicious.xyz', '*@spam-domain.net'],
		blockedToday: 47,
		falsePositives: 2
	});
};

export const PATCH: RequestHandler = async ({ request }) => {
	// TODO: Replace with real Rspamd configuration update
	const data = await request.json();
	return json({ ...data, updated: true });
};
