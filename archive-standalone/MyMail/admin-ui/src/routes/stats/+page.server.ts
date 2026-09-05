import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const period = (url.searchParams.get('period') ?? '7d') as '7d' | '30d' | '90d';

	// TODO: Replace with real Stalwart/Rspamd API calls
	const labels7d = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const labels30d = Array.from({ length: 30 }, (_, i) => `${i + 1}`);
	const labels90d = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].slice(0, 12);

	const generate = (count: number, min: number, max: number) =>
		Array.from({ length: count }, () => Math.floor(Math.random() * (max - min) + min));

	const counts = { '7d': 7, '30d': 30, '90d': 12 };
	const labelsMap = { '7d': labels7d, '30d': labels30d, '90d': labels90d };

	const n = counts[period];

	return {
		period,
		stats: {
			period,
			sent: generate(n, 20, 100),
			received: generate(n, 50, 200),
			blocked: generate(n, 5, 40),
			labels: labelsMap[period],
			deliverability: [
				{ provider: 'Gmail', delivered: 945, bounced: 12, deferred: 8, rate: 97.9 },
				{ provider: 'Outlook', delivered: 412, bounced: 5, deferred: 3, rate: 98.1 },
				{ provider: 'Yahoo', delivered: 198, bounced: 8, deferred: 4, rate: 94.3 },
				{ provider: 'Other', delivered: 321, bounced: 15, deferred: 9, rate: 93.0 }
			],
			topSenders: [
				{ email: 'admin@example.com', count: 245 },
				{ email: 'alice@example.com', count: 189 },
				{ email: 'bob@example.com', count: 132 },
				{ email: 'noreply@example.com', count: 87 }
			],
			topRecipients: [
				{ email: 'support@gmail.com', count: 156 },
				{ email: 'orders@company.org', count: 98 },
				{ email: 'info@partner.net', count: 76 },
				{ email: 'admin@example.com', count: 64 }
			]
		}
	};
};
