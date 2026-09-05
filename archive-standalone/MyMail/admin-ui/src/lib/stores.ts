import { writable } from 'svelte/store';
import type { HealthStatus, Toast, User } from './types';

// Health store
export const health = writable<HealthStatus | null>(null);

// User/auth store
export const user = writable<User | null>(null);

// Toast notifications
function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);

	function add(type: Toast['type'], message: string) {
		const id = crypto.randomUUID();
		update((toasts) => [...toasts, { id, type, message }]);
		setTimeout(() => remove(id), 5000);
	}

	function remove(id: string) {
		update((toasts) => toasts.filter((t) => t.id !== id));
	}

	return {
		subscribe,
		success: (msg: string) => add('success', msg),
		error: (msg: string) => add('error', msg),
		warning: (msg: string) => add('warning', msg),
		info: (msg: string) => add('info', msg),
		remove
	};
}

export const toasts = createToastStore();

// Theme store
function createThemeStore() {
	const { subscribe, set, update } = writable<'dark' | 'light'>('dark');

	return {
		subscribe,
		toggle: () => {
			update((current) => {
				const next = current === 'dark' ? 'light' : 'dark';
				if (typeof document !== 'undefined') {
					document.documentElement.classList.toggle('light', next === 'light');
					document.documentElement.classList.toggle('dark', next === 'dark');
					localStorage.setItem('theme', next);
				}
				return next;
			});
		},
		init: () => {
			if (typeof window !== 'undefined') {
				const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
				const theme = saved ?? 'dark';
				set(theme);
				document.documentElement.classList.toggle('light', theme === 'light');
				document.documentElement.classList.toggle('dark', theme === 'dark');
			}
		}
	};
}

export const theme = createThemeStore();

// Sidebar collapsed state
export const sidebarCollapsed = writable(false);
