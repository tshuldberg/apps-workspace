import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// TODO: Replace with real Rspamd API calls
	return {
		spam: {
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
				},
				{
					id: '3',
					from: 'newsletter@unknown-sender.net',
					to: 'bob@example.com',
					subject: 'Weekly digest - Important updates',
					score: 6.1,
					receivedAt: '2025-03-13T22:30:00Z'
				}
			],
			whitelist: ['newsletter@trusted.com', 'updates@github.com'],
			blacklist: ['spam@malicious.xyz', '*@spam-domain.net'],
			blockedToday: 47,
			falsePositives: 2
		}
	};
};
