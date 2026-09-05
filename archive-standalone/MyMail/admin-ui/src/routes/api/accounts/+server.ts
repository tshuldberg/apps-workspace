import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	// TODO: Replace with real Stalwart account API
	return json([
		{
			id: '1',
			email: 'admin@example.com',
			displayName: 'Admin User',
			storageUsed: 1.2e9,
			storageLimit: 5e9,
			status: 'active',
			createdAt: '2025-01-15T10:00:00Z',
			lastLogin: '2025-03-14T08:30:00Z'
		},
		{
			id: '2',
			email: 'alice@example.com',
			displayName: 'Alice Johnson',
			storageUsed: 0.8e9,
			storageLimit: 2e9,
			status: 'active',
			createdAt: '2025-01-20T14:00:00Z',
			lastLogin: '2025-03-13T16:45:00Z'
		}
	]);
};

export const POST: RequestHandler = async ({ request }) => {
	// TODO: Replace with real Stalwart account creation API
	const data = await request.json();
	return json({
		id: crypto.randomUUID(),
		email: data.email,
		displayName: data.displayName,
		storageUsed: 0,
		storageLimit: data.storageLimit * 1e9,
		status: 'active',
		createdAt: new Date().toISOString(),
		lastLogin: null
	}, { status: 201 });
};
