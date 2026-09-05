import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	// TODO: Replace with real Stalwart domain API
	return json([
		{
			id: '1',
			name: 'example.com',
			dnsVerified: true,
			mxRecord: { type: 'MX', hostname: 'example.com', value: 'mail.example.com (priority 10)', verified: true },
			spfRecord: { type: 'TXT', hostname: 'example.com', value: 'v=spf1 mx a ip4:203.0.113.1 -all', verified: true },
			dkimRecord: { type: 'TXT', hostname: 'default._domainkey.example.com', value: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQ...', verified: true },
			dmarcRecord: { type: 'TXT', hostname: '_dmarc.example.com', value: 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com', verified: true },
			createdAt: '2025-01-15T10:00:00Z'
		}
	]);
};

export const POST: RequestHandler = async ({ request }) => {
	// TODO: Replace with real Stalwart domain creation API
	const { name } = await request.json();
	return json({
		id: crypto.randomUUID(),
		name,
		dnsVerified: false,
		mxRecord: { type: 'MX', hostname: name, value: `mail.${name} (priority 10)`, verified: false },
		spfRecord: { type: 'TXT', hostname: name, value: `v=spf1 mx -all`, verified: false },
		dkimRecord: { type: 'TXT', hostname: `default._domainkey.${name}`, value: 'v=DKIM1; k=rsa; p=...', verified: false },
		dmarcRecord: { type: 'TXT', hostname: `_dmarc.${name}`, value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${name}`, verified: false },
		createdAt: new Date().toISOString()
	}, { status: 201 });
};
