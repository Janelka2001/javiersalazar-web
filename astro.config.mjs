// @ts-check
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://javiersalazar.es',
	output: 'static',
	trailingSlash: 'always',
	integrations: [
		sitemap({
			filter: (page) => !page.endsWith('/404/') && !page.endsWith('/buscar/'),
		}),
	],
	server: {
		host: true,
		port: 4321,
	},
	vite: {
		server: {
			allowedHosts: ['web'],
		},
	},
});
