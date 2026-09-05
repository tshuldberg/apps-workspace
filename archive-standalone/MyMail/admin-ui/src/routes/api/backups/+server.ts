import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	// TODO: Replace with real backup system API
	return json({
		lastBackup: {
			id: 'bk-001',
			date: '2025-03-14T03:00:00Z',
			size: 2.1e9,
			duration: 342,
			status: 'completed'
		},
		history: [
			{ id: 'bk-001', date: '2025-03-14T03:00:00Z', size: 2.1e9, duration: 342, status: 'completed' },
			{ id: 'bk-002', date: '2025-03-13T03:00:00Z', size: 2.0e9, duration: 318, status: 'completed' },
			{ id: 'bk-003', date: '2025-03-12T03:00:00Z', size: 2.0e9, duration: 325, status: 'completed' }
		],
		storageBreakdown: [
			{ account: 'admin@example.com', size: 1.2e9 },
			{ account: 'alice@example.com', size: 0.8e9 },
			{ account: 'bob@example.com', size: 0.3e9 }
		]
	});
};

export const POST: RequestHandler = async () => {
	// TODO: Replace with real backup trigger
	return json({ id: `bk-${Date.now()}`, status: 'started' });
};
