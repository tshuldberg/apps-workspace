import { writable, derived } from 'svelte/store';

export interface WizardData {
	domain: string;
	hostname: string;
	serverIp: string;
	relayProvider: 'ses' | 'sendgrid' | 'mailgun' | 'postmark' | 'none' | '';
	relayHost: string;
	relayPort: number;
	relayUser: string;
	relayPassword: string;
	adminEmail: string;
	adminPassword: string;
	adminDisplayName: string;
}

export interface WizardState {
	currentStep: number;
	data: WizardData;
	completedSteps: Set<number>;
}

export const STEPS = [
	{ number: 1, label: 'Welcome', path: '/setup/welcome' },
	{ number: 2, label: 'Domain', path: '/setup/domain' },
	{ number: 3, label: 'DNS', path: '/setup/dns' },
	{ number: 4, label: 'Relay', path: '/setup/relay' },
	{ number: 5, label: 'Account', path: '/setup/account' },
	{ number: 6, label: 'Test', path: '/setup/test' },
	{ number: 7, label: 'Complete', path: '/setup/complete' }
] as const;

function createWizardStore() {
	const { subscribe, set, update } = writable<WizardState>({
		currentStep: 1,
		data: {
			domain: '',
			hostname: '',
			serverIp: '',
			relayProvider: '',
			relayHost: '',
			relayPort: 587,
			relayUser: '',
			relayPassword: '',
			adminEmail: '',
			adminPassword: '',
			adminDisplayName: ''
		},
		completedSteps: new Set<number>()
	});

	return {
		subscribe,
		set,
		next: () =>
			update((state) => {
				if (state.currentStep < 7) {
					state.completedSteps.add(state.currentStep);
					state.currentStep++;
				}
				return state;
			}),
		prev: () =>
			update((state) => {
				if (state.currentStep > 1) {
					state.currentStep--;
				}
				return state;
			}),
		goTo: (step: number) =>
			update((state) => {
				if (step >= 1 && step <= 7) {
					state.currentStep = step;
				}
				return state;
			}),
		completeStep: (step: number) =>
			update((state) => {
				state.completedSteps.add(step);
				return state;
			}),
		updateData: (partial: Partial<WizardData>) =>
			update((state) => {
				state.data = { ...state.data, ...partial };
				return state;
			}),
		reset: () =>
			set({
				currentStep: 1,
				data: {
					domain: '',
					hostname: '',
					serverIp: '',
					relayProvider: '',
					relayHost: '',
					relayPort: 587,
					relayUser: '',
					relayPassword: '',
					adminEmail: '',
					adminPassword: '',
					adminDisplayName: ''
				},
				completedSteps: new Set<number>()
			})
	};
}

export const wizard = createWizardStore();
