import type {
	HealthStatus,
	Domain,
	Account,
	MailStats,
	SpamConfig,
	BackupData,
	Settings
} from './types';

const BASE_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(`${BASE_URL}${path}`, {
		headers: {
			'Content-Type': 'application/json',
			...options?.headers
		},
		...options
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`API error ${res.status}: ${body}`);
	}

	return res.json();
}

// Health
export function getHealth(): Promise<HealthStatus> {
	return request('/health');
}

// Domains
export function getDomains(): Promise<Domain[]> {
	return request('/domains');
}

export function addDomain(name: string): Promise<Domain> {
	return request('/domains', {
		method: 'POST',
		body: JSON.stringify({ name })
	});
}

export function deleteDomain(id: string): Promise<void> {
	return request(`/domains/${id}`, { method: 'DELETE' });
}

export function validateDns(domainId: string): Promise<{ valid: boolean; errors: string[] }> {
	return request(`/domains/${domainId}/validate`);
}

// Accounts
export function getAccounts(): Promise<Account[]> {
	return request('/accounts');
}

export function createAccount(data: {
	email: string;
	displayName: string;
	password: string;
	storageLimit: number;
}): Promise<Account> {
	return request('/accounts', {
		method: 'POST',
		body: JSON.stringify(data)
	});
}

export function updateAccount(id: string, data: Partial<Account>): Promise<Account> {
	return request(`/accounts/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(data)
	});
}

export function deleteAccount(id: string): Promise<void> {
	return request(`/accounts/${id}`, { method: 'DELETE' });
}

// Stats
export function getStats(period: '7d' | '30d' | '90d' = '7d'): Promise<MailStats> {
	return request(`/stats?period=${period}`);
}

// Spam
export function getSpamConfig(): Promise<SpamConfig> {
	return request('/spam');
}

export function updateSpamConfig(data: Partial<SpamConfig>): Promise<SpamConfig> {
	return request('/spam', {
		method: 'PATCH',
		body: JSON.stringify(data)
	});
}

export function releaseQuarantined(id: string): Promise<void> {
	return request(`/spam/quarantine/${id}/release`, { method: 'POST' });
}

export function deleteQuarantined(id: string): Promise<void> {
	return request(`/spam/quarantine/${id}`, { method: 'DELETE' });
}

// Backups
export function getBackups(): Promise<BackupData> {
	return request('/backups');
}

export function triggerBackup(): Promise<{ id: string }> {
	return request('/backups', { method: 'POST' });
}

export function restoreBackup(id: string): Promise<void> {
	return request(`/backups/${id}/restore`, { method: 'POST' });
}

// Settings
export function getSettings(): Promise<Settings> {
	return request('/settings');
}

export function updateSettings(data: Partial<Settings>): Promise<Settings> {
	return request('/settings', {
		method: 'PATCH',
		body: JSON.stringify(data)
	});
}

export function testRelayConnection(): Promise<{ success: boolean; message: string }> {
	return request('/settings/test-relay', { method: 'POST' });
}

// Setup
export function sendTestEmail(to: string): Promise<{ success: boolean; message: string }> {
	return request('/setup/test-email', {
		method: 'POST',
		body: JSON.stringify({ to })
	});
}

export function checkDns(): Promise<{ results: { record: string; status: string }[] }> {
	return request('/setup/dns-check', { method: 'POST' });
}
