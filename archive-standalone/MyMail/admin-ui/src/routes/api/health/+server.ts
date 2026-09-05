import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	// TODO: Replace with real health checks against Stalwart, Rspamd, Caddy
	return json({
		status: 'ok',
		uptime: 864000,
		version: '0.1.0',
		services: {
			stalwart: { status: 'running', uptime: 864000, memory: 256e6 },
			rspamd: { status: 'running', uptime: 863500, memory: 128e6 },
			caddy: { status: 'running', uptime: 864000, memory: 64e6 }
		},
		storage: { used: 2.4e9, total: 10e9 },
		mailQueue: 3,
		messagesToday: { sent: 142, received: 387 }
	});
};
