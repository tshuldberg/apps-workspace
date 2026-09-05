import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// TODO: Replace with real Stalwart API call
	return {
		domains: [
			{
				id: '1',
				name: 'example.com',
				dnsVerified: true,
				mxRecord: { type: 'MX', hostname: 'example.com', value: 'mail.example.com (priority 10)', verified: true },
				spfRecord: { type: 'TXT', hostname: 'example.com', value: 'v=spf1 mx a ip4:203.0.113.1 -all', verified: true },
				dkimRecord: { type: 'TXT', hostname: 'default._domainkey.example.com', value: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQ...', verified: true },
				dmarcRecord: { type: 'TXT', hostname: '_dmarc.example.com', value: 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com', verified: true },
				createdAt: '2025-01-15T10:00:00Z'
			},
			{
				id: '2',
				name: 'company.org',
				dnsVerified: false,
				mxRecord: { type: 'MX', hostname: 'company.org', value: 'mail.company.org (priority 10)', verified: true },
				spfRecord: { type: 'TXT', hostname: 'company.org', value: 'v=spf1 mx -all', verified: false },
				dkimRecord: { type: 'TXT', hostname: 'default._domainkey.company.org', value: 'v=DKIM1; k=rsa; p=MIGfMA0GCSq...', verified: false },
				dmarcRecord: { type: 'TXT', hostname: '_dmarc.company.org', value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@company.org', verified: false },
				createdAt: '2025-02-01T14:30:00Z'
			}
		]
	};
};
