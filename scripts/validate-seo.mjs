import { readFile, readdir } from 'node:fs/promises';
import './load-project-env.mjs';

const distUrl = new URL('../dist/', import.meta.url);
const shouldIndex = process.env.SITE_READY === 'true';

async function listHtmlFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(entries.map(async (entry) => {
		const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);

		if (entry.isDirectory()) {
			return listHtmlFiles(url);
		}

		return entry.name.endsWith('.html') ? [url] : [];
	}));

	return nested.flat();
}

function requireMatch(html, pattern, label, file, problems) {
	const match = html.match(pattern);

	if (!match) {
		problems.push(`${file}: falta ${label}`);
	}

	return match;
}

function decodeHtmlAttribute(value) {
	return value
		.replaceAll('&quot;', '"')
		.replaceAll('&apos;', "'")
		.replaceAll('&#39;', "'")
		.replaceAll('&#x27;', "'")
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&amp;', '&')
		.replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
		.replace(/&#x([\da-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)));
}

const files = await listHtmlFiles(distUrl);
const problems = [];
const canonicalOrigin = 'https://javiersalazar.es';
let expectedSocialOrigin = canonicalOrigin;

if (!shouldIndex && process.env.CF_PAGES_URL) {
	try {
		const previewUrl = new URL(process.env.CF_PAGES_URL);
		if (previewUrl.protocol !== 'https:') {
			throw new Error('el protocolo debe ser HTTPS');
		}
		expectedSocialOrigin = previewUrl.origin;
	} catch (error) {
		problems.push(`CF_PAGES_URL no válida: ${error instanceof Error ? error.message : String(error)}`);
	}
}

for (const file of files) {
	const html = await readFile(file, 'utf8');
	const relative = decodeURIComponent(file.href.slice(distUrl.href.length));
	const is404 = relative === '404.html';
	const isSearch = relative === 'buscar/index.html';
	const description = requireMatch(
		html,
		/<meta name="description" content="([^"]*)">/,
		'meta description',
		relative,
		problems,
	)?.[1];

	const decodedDescription = description ? decodeHtmlAttribute(description) : '';
	if (decodedDescription.length > 160) {
		problems.push(`${relative}: meta description de ${decodedDescription.length} caracteres`);
	}

	requireMatch(html, /<meta property="og:title" content="[^"]+">/, 'og:title', relative, problems);
	requireMatch(html, /<meta property="og:description" content="[^"]+">/, 'og:description', relative, problems);
	const ogImage = requireMatch(
		html,
		/<meta property="og:image" content="(https:\/\/[^\"]+)">/,
		'og:image absoluto',
		relative,
		problems,
	)?.[1];
	requireMatch(html, /<meta name="twitter:card" content="summary_large_image">/, 'Twitter Card', relative, problems);
	const twitterImage = requireMatch(
		html,
		/<meta name="twitter:image" content="(https:\/\/[^\"]+)">/,
		'twitter:image absoluto',
		relative,
		problems,
	)?.[1];

	if (ogImage) {
		if (new URL(ogImage).origin !== expectedSocialOrigin) {
			problems.push(`${relative}: og:image no usa el origen social esperado ${expectedSocialOrigin}`);
		}
		if (relative === 'index.html' && new URL(ogImage).pathname !== '/og.png') {
			problems.push('index.html: la tarjeta social de portada debe ser /og.png');
		}
	}
	if (ogImage && twitterImage !== ogImage) {
		problems.push(`${relative}: twitter:image no coincide con og:image`);
	}

	const robots = requireMatch(
		html,
		/<meta name="robots" content="([^"]+)">/,
		'robots meta',
		relative,
		problems,
	)?.[1];
	const canonical = html.match(/<link rel="canonical" href="([^"]+)">/);

	if (is404) {
		if (!robots?.startsWith('noindex')) {
			problems.push(`${relative}: el 404 debe ser noindex`);
		}
		if (canonical) {
			problems.push(`${relative}: el 404 no debe declarar canonical`);
		}
	} else {
		if (!canonical?.[1].startsWith('https://javiersalazar.es/')) {
			problems.push(`${relative}: canonical ausente o no absoluto`);
		}
		const shouldPageIndex = shouldIndex && !isSearch;
		if (shouldPageIndex ? !robots?.startsWith('index') : !robots?.startsWith('noindex')) {
			problems.push(`${relative}: robots meta no coincide con SITE_READY`);
		}
		if (isSearch && canonical?.[1] !== 'https://javiersalazar.es/buscar/') {
			problems.push(`${relative}: canonical de búsqueda incorrecto`);
		}
	}

	const jsonLd = requireMatch(
		html,
		/<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
		'JSON-LD',
		relative,
		problems,
	)?.[1];

	if (jsonLd) {
		try {
			JSON.parse(jsonLd);
		} catch {
			problems.push(`${relative}: JSON-LD no válido`);
		}
	}
}

const sitemap = await readFile(new URL('sitemap-0.xml', distUrl), 'utf8');
const sitemapLocations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
const sitemapUrls = sitemapLocations.length;
if (sitemapUrls === 0 || sitemapLocations.some((pathname) => pathname === '/404/' || pathname === '/404.html')) {
	problems.push('sitemap-0.xml: vacío o contiene el 404');
}
if (sitemapLocations.includes('/buscar/')) {
	problems.push('sitemap-0.xml: contiene la página noindex /buscar/');
}

const rss = await readFile(new URL('rss.xml', distUrl), 'utf8');
const rssItems = rss.match(/<item>/g)?.length ?? 0;
if (rssItems === 0) {
	problems.push('rss.xml: no contiene fotografías');
}

const robotsTxt = await readFile(new URL('robots.txt', distUrl), 'utf8');
if (shouldIndex ? !robotsTxt.includes('Allow: /') : !robotsTxt.includes('Disallow: /')) {
	problems.push('robots.txt: no coincide con SITE_READY');
}

if (problems.length > 0) {
	throw new Error(`Validación SEO fallida:\n- ${problems.join('\n- ')}`);
}

console.log(`SEO QA OK: ${files.length} HTML, ${sitemapUrls} URLs en sitemap y ${rssItems} entradas RSS.`);
