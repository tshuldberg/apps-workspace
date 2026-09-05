import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const { host, port, user, password } = body as Record<string, string>;

	// TODO: Replace with real SMTP connection test
	// Use nodemailer.createTransport() or net.connect() to verify the relay

	// Simulate connection test delay
	await new Promise((r) => setTimeout(r, 1200));

	if (!host || !user) {
		return json({
			success: false,
			message: 'Host and username are required'
		});
	}

	// Mock success
	return json({
		success: true,
		message: `Connected to ${host}:${port || 587} successfully`
	});
};
