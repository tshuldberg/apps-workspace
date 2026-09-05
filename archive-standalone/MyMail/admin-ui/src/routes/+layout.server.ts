import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ url, cookies }) => {
	// TODO: Replace with real auth check against Stalwart API
	const sessionToken = cookies.get('session');
	const isAuthenticated = !!sessionToken;

	const publicPaths = ['/login', '/setup'];
	const isPublicPath = publicPaths.some((p) => url.pathname.startsWith(p));

	return {
		isAuthenticated,
		isPublicPath,
		pathname: url.pathname
	};
};
