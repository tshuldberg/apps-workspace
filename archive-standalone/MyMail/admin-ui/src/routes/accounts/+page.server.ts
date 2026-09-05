import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// TODO: Replace with real Stalwart API call
	return {
		accounts: [
			{
				id: '1',
				email: 'admin@example.com',
				displayName: 'Admin User',
				storageUsed: 1.2e9,
				storageLimit: 5e9,
				status: 'active' as const,
				createdAt: '2025-01-15T10:00:00Z',
				lastLogin: '2025-03-14T08:30:00Z'
			},
			{
				id: '2',
				email: 'alice@example.com',
				displayName: 'Alice Johnson',
				storageUsed: 0.8e9,
				storageLimit: 2e9,
				status: 'active' as const,
				createdAt: '2025-01-20T14:00:00Z',
				lastLogin: '2025-03-13T16:45:00Z'
			},
			{
				id: '3',
				email: 'bob@example.com',
				displayName: 'Bob Smith',
				storageUsed: 0.3e9,
				storageLimit: 2e9,
				status: 'active' as const,
				createdAt: '2025-02-01T09:00:00Z',
				lastLogin: '2025-03-12T11:20:00Z'
			},
			{
				id: '4',
				email: 'noreply@example.com',
				displayName: 'No Reply',
				storageUsed: 0.05e9,
				storageLimit: 1e9,
				status: 'disabled' as const,
				createdAt: '2025-02-10T12:00:00Z',
				lastLogin: null
			}
		]
	};
};
