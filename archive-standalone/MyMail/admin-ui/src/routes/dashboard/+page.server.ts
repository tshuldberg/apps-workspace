import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// TODO: Replace with real API calls to Stalwart/Rspamd
	return {
		health: {
			status: 'ok' as const,
			uptime: 864000,
			version: '0.1.0',
			storage: { used: 2.4e9, total: 10e9 },
			mailQueue: 3,
			messagesToday: { sent: 142, received: 387 }
		},
		recentActivity: {
			labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
			sent: [45, 62, 38, 71, 55, 22, 48],
			received: [120, 98, 145, 112, 135, 67, 93]
		},
		alerts: [
			{ level: 'warning' as const, message: 'TLS certificate expires in 14 days' },
			{ level: 'info' as const, message: 'Rspamd updated to v3.8.1' }
		]
	};
};
