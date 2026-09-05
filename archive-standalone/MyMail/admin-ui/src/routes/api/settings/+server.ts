import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	// TODO: Replace with real system configuration API
	return json({
		relay: {
			host: 'smtp.sendgrid.net',
			port: 587,
			user: 'apikey',
			password: '********'
		},
		tls: {
			provider: "Let's Encrypt",
			status: 'valid',
			expiresAt: '2025-06-15T00:00:00Z',
			autoRenew: true
		},
		system: {
			version: '0.1.0',
			uptime: 864000,
			os: 'Alpine Linux 3.19',
			memory: { used: 512e6, total: 2e9 },
			disk: { used: 2.4e9, total: 10e9 }
		},
		logs: []
	});
};

export const PATCH: RequestHandler = async ({ request }) => {
	// TODO: Replace with real settings update
	const data = await request.json();
	return json({ ...data, updated: true });
};
