import type { APIRoute } from 'astro';
import { siteReadyForIndexing } from '../lib/seo';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
	const sitemap = new URL('/sitemap-index.xml', site);
	const body = siteReadyForIndexing
		? `User-agent: *\nAllow: /\n\nSitemap: ${sitemap.href}\n`
		: `User-agent: *\nDisallow: /\n\n# Entorno de vista previa: no indexar.\n`;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	});
};
