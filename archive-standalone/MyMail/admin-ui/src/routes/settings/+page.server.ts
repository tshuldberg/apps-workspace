import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// TODO: Replace with real system API calls
	return {
		settings: {
			relay: {
				host: 'smtp.sendgrid.net',
				port: 587,
				user: 'apikey',
				password: '********'
			},
			tls: {
				provider: "Let's Encrypt",
				status: 'valid' as const,
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
			logs: [
				{ timestamp: '2025-03-14T08:30:12Z', level: 'info' as const, service: 'stalwart', message: 'Message delivered to alice@example.com' },
				{ timestamp: '2025-03-14T08:29:45Z', level: 'info' as const, service: 'rspamd', message: 'Spam score 2.1 for message from newsletter@company.com' },
				{ timestamp: '2025-03-14T08:28:33Z', level: 'warn' as const, service: 'stalwart', message: 'Connection timeout to smtp.gmail.com, retrying...' },
				{ timestamp: '2025-03-14T08:27:10Z', level: 'info' as const, service: 'caddy', message: 'TLS handshake completed for mail.example.com' },
				{ timestamp: '2025-03-14T08:26:55Z', level: 'error' as const, service: 'rspamd', message: 'Failed to update RBL database: connection refused' },
				{ timestamp: '2025-03-14T08:25:00Z', level: 'info' as const, service: 'stalwart', message: 'IMAP session started for bob@example.com' },
				{ timestamp: '2025-03-14T08:24:30Z', level: 'debug' as const, service: 'stalwart', message: 'DNS lookup for mx.outlook.com completed' },
				{ timestamp: '2025-03-14T08:23:15Z', level: 'info' as const, service: 'stalwart', message: 'Incoming message from support@partner.net accepted' },
				{ timestamp: '2025-03-14T08:22:00Z', level: 'info' as const, service: 'rspamd', message: 'Greylisting passed for orders@vendor.com' },
				{ timestamp: '2025-03-14T08:21:30Z', level: 'warn' as const, service: 'caddy', message: 'Rate limit approaching for IP 198.51.100.42' }
			]
		}
	};
};
