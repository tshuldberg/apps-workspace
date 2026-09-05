import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const period = url.searchParams.get('period') ?? '7d';

	// TODO: Replace with real Stalwart/Rspamd statistics API
	const generate = (count: number, min: number, max: number) =>
		Array.from({ length: count }, () => Math.floor(Math.random() * (max - min) + min));

	const configs: Record<string, { count: number; labels: string[] }> = {
		'7d': { count: 7, labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
		'30d': { count: 30, labels: Array.from({ length: 30 }, (_, i) => `${i + 1}`) },
		'90d': { count: 12, labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] }
	};

	const cfg = configs[period] ?? configs['7d'];

	return json({
		period,
		sent: generate(cfg.count, 20, 100),
		received: generate(cfg.count, 50, 200),
		blocked: generate(cfg.count, 5, 40),
		labels: cfg.labels,
		deliverability: [
			{ provider: 'Gmail', delivered: 945, bounced: 12, deferred: 8, rate: 97.9 },
			{ provider: 'Outlook', delivered: 412, bounced: 5, deferred: 3, rate: 98.1 },
			{ provider: 'Yahoo', delivered: 198, bounced: 8, deferred: 4, rate: 94.3 },
			{ provider: 'Other', delivered: 321, bounced: 15, deferred: 9, rate: 93.0 }
		],
		topSenders: [
			{ email: 'admin@example.com', count: 245 },
			{ email: 'alice@example.com', count: 189 },
			{ email: 'bob@example.com', count: 132 }
		],
		topRecipients: [
			{ email: 'support@gmail.com', count: 156 },
			{ email: 'orders@company.org', count: 98 },
			{ email: 'info@partner.net', count: 76 }
		]
	});
};
