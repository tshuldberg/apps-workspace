export interface Domain {
	id: string;
	name: string;
	dnsVerified: boolean;
	mxRecord: DnsRecord;
	spfRecord: DnsRecord;
	dkimRecord: DnsRecord;
	dmarcRecord: DnsRecord;
	createdAt: string;
}

export interface DnsRecord {
	type: string;
	hostname: string;
	value: string;
	verified: boolean;
}

export interface Account {
	id: string;
	email: string;
	displayName: string;
	storageUsed: number;
	storageLimit: number;
	status: 'active' | 'disabled' | 'suspended';
	createdAt: string;
	lastLogin: string | null;
}

export interface HealthStatus {
	status: 'ok' | 'warning' | 'error';
	uptime: number;
	version: string;
	services: {
		stalwart: ServiceStatus;
		rspamd: ServiceStatus;
		caddy: ServiceStatus;
	};
	storage: {
		used: number;
		total: number;
	};
	mailQueue: number;
	messagestoday: {
		sent: number;
		received: number;
	};
}

export interface ServiceStatus {
	status: 'running' | 'stopped' | 'error';
	uptime: number;
	memory: number;
}

export interface MailStats {
	period: '7d' | '30d' | '90d';
	sent: number[];
	received: number[];
	blocked: number[];
	labels: string[];
	deliverability: DeliverabilityRate[];
	topSenders: { email: string; count: number }[];
	topRecipients: { email: string; count: number }[];
}

export interface DeliverabilityRate {
	provider: string;
	delivered: number;
	bounced: number;
	deferred: number;
	rate: number;
}

export interface SpamRule {
	id: string;
	name: string;
	weight: number;
	enabled: boolean;
}

export interface SpamConfig {
	sensitivity: number;
	quarantine: QuarantineItem[];
	whitelist: string[];
	blacklist: string[];
	blockedToday: number;
	falsePositives: number;
}

export interface QuarantineItem {
	id: string;
	from: string;
	to: string;
	subject: string;
	score: number;
	receivedAt: string;
}

export interface BackupInfo {
	id: string;
	date: string;
	size: number;
	duration: number;
	status: 'completed' | 'failed' | 'in_progress';
}

export interface BackupData {
	lastBackup: BackupInfo;
	history: BackupInfo[];
	storageBreakdown: { account: string; size: number }[];
}

export interface Settings {
	relay: {
		host: string;
		port: number;
		user: string;
		password: string;
	};
	tls: {
		provider: string;
		status: 'valid' | 'expiring' | 'expired';
		expiresAt: string;
		autoRenew: boolean;
	};
	system: {
		version: string;
		uptime: number;
		os: string;
		memory: { used: number; total: number };
		disk: { used: number; total: number };
	};
	logs: LogEntry[];
}

export interface LogEntry {
	timestamp: string;
	level: 'info' | 'warn' | 'error' | 'debug';
	service: string;
	message: string;
}

export interface Toast {
	id: string;
	type: 'success' | 'error' | 'warning' | 'info';
	message: string;
}

export interface User {
	email: string;
	name: string;
	isAdmin: boolean;
}
