import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// TODO: Replace with real backup system API calls
	return {
		backups: {
			lastBackup: {
				id: 'bk-001',
				date: '2025-03-14T03:00:00Z',
				size: 2.1e9,
				duration: 342,
				status: 'completed' as const
			},
			history: [
				{ id: 'bk-001', date: '2025-03-14T03:00:00Z', size: 2.1e9, duration: 342, status: 'completed' as const },
				{ id: 'bk-002', date: '2025-03-13T03:00:00Z', size: 2.0e9, duration: 318, status: 'completed' as const },
				{ id: 'bk-003', date: '2025-03-12T03:00:00Z', size: 2.0e9, duration: 325, status: 'completed' as const },
				{ id: 'bk-004', date: '2025-03-11T03:00:00Z', size: 1.9e9, duration: 298, status: 'completed' as const },
				{ id: 'bk-005', date: '2025-03-10T03:00:00Z', size: 1.9e9, duration: 0, status: 'failed' as const }
			],
			storageBreakdown: [
				{ account: 'admin@example.com', size: 1.2e9 },
				{ account: 'alice@example.com', size: 0.8e9 },
				{ account: 'bob@example.com', size: 0.3e9 },
				{ account: 'noreply@example.com', size: 0.05e9 }
			]
		}
	};
};
