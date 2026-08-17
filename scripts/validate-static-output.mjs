import { readFile, readdir, stat } from 'node:fs/promises';
import './load-project-env.mjs';

const projectRoot = new URL('../', import.meta.url);
const distUrl = new URL('dist/', projectRoot);
const siteOrigin = 'https://javiersalazar.es';
const pageSize = 24;
const catalog = JSON.parse(await readFile(new URL('src/data/photos.json', projectRoot), 'utf8'));
const photos = catalog.photos ?? [];

async function listFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(entries.map(async (entry) => {
		const url = new URL(encodeURIComponent(entry.name) + (entry.isDirectory() ? '/' : ''), directory);
		return entry.isDirectory() ? listFiles(url) : [url];
	}));
	return nested.flat();
}

function outputName(url) {
	return decodeURIComponent(url.href.slice(distUrl.href.length));
}

function pageFile(pathname) {
	const clean = decodeURIComponent(pathname).replace(/^\/+/, '');
	if (!clean) return 'index.html';
	if (clean.endsWith('/')) return `${clean}index.html`;
	return clean.includes('.') ? clean : `${clean}/index.html`;
}

const files = await listFiles(distUrl);
const fileNames = new Set(files.map(outputName));
const htmlFiles = files.filter((file) => file.pathname.endsWith('.html'));
const problems = new Set();

if (files.length > 20_000) {
	problems.add(`salida: ${files.length} archivos; el límite de Pages es 20.000`);
}

let totalBytes = 0;
let largest = { name: '', bytes: 0 };
for (const file of files) {
	const fileStat = await stat(file);
	totalBytes += fileStat.size;
	if (fileStat.size > largest.bytes) largest = { name: outputName(file), bytes: fileStat.size };
	if (fileStat.size > 25 * 1024 * 1024) problems.add(`${outputName(file)}: supera 25 MiB`);
}

const expectedPhotoFiles = photos.map(
	(photo) => `fotografia/${photo.legacyId}/${photo.slug}/index.html`,
);
for (const file of expectedPhotoFiles) {
	if (!fileNames.has(file)) problems.add(`${file}: ficha fotográfica ausente`);
}

const galleryPages = Math.ceil(photos.length / pageSize);
for (let page = 1; page <= galleryPages; page += 1) {
	const file = page === 1 ? 'galeria/index.html' : `galeria/${page}/index.html`;
	if (!fileNames.has(file)) problems.add(`${file}: página de galería ausente`);
}

const categoryCounts = new Map();
const yearCounts = new Map();
for (const photo of photos) {
	for (const category of photo.categories) {
		categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
	}
	const year = photo.publishedAtLegacy.slice(0, 4);
	yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
}

for (const [slug, count] of categoryCounts) {
	for (let page = 1; page <= Math.ceil(count / pageSize); page += 1) {
		const file = page === 1
			? `categoria/${slug}/index.html`
			: `categoria/${slug}/${page}/index.html`;
		if (!fileNames.has(file)) problems.add(`${file}: página de categoría ausente`);
	}
}

if (!fileNames.has('archivo/index.html')) problems.add('archivo/index.html: índice de archivo ausente');
for (const [year, count] of yearCounts) {
	for (let page = 1; page <= Math.ceil(count / pageSize); page += 1) {
		const file = page === 1
			? `archivo/${year}/index.html`
			: `archivo/${year}/${page}/index.html`;
		if (!fileNames.has(file)) problems.add(`${file}: página de archivo ausente`);
	}
}

if (!fileNames.has('buscar/index.html')) {
	problems.add('buscar/index.html: página de búsqueda ausente');
}

const searchIndexName = 'buscar/indice.json';
if (!fileNames.has(searchIndexName)) {
	problems.add(`${searchIndexName}: índice de búsqueda ausente`);
} else {
	try {
		const searchIndex = JSON.parse(await readFile(new URL(searchIndexName, distUrl), 'utf8'));
		const indexedPhotos = searchIndex.photos;

		if (!Array.isArray(indexedPhotos)) {
			problems.add(`${searchIndexName}: formato de índice no válido`);
		} else {
			if (indexedPhotos.length !== photos.length) {
				problems.add(`${searchIndexName}: contiene ${indexedPhotos.length} entradas; el catálogo contiene ${photos.length}`);
			}

			const indexedHrefs = new Set(indexedPhotos.map((photo) => photo.href));
			if (indexedHrefs.size !== indexedPhotos.length) {
				problems.add(`${searchIndexName}: contiene rutas duplicadas`);
			}
			for (const photo of photos) {
				if (!indexedHrefs.has(photo.route)) {
					problems.add(`${searchIndexName}: falta la fotografía ${photo.legacyId}`);
				}
			}
			if ([...indexedHrefs].some((href) => !photos.some((photo) => photo.route === href))) {
				problems.add(`${searchIndexName}: contiene fotografías ajenas al catálogo`);
			}
		}
	} catch {
		problems.add(`${searchIndexName}: JSON no válido`);
	}
}

for (const file of htmlFiles) {
	const html = await readFile(file, 'utf8');
	const relative = outputName(file);
	const routePath = relative === 'index.html'
		? '/'
		: `/${relative.replace(/index\.html$/, '')}`;
	const pageUrl = new URL(routePath, siteOrigin);
	const rawTargets = [];

	for (const match of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) rawTargets.push(match[1]);
	for (const match of html.matchAll(/\ssrcset="([^"]+)"/g)) {
		for (const candidate of match[1].split(',')) {
			const [target] = candidate.trim().split(/\s+/);
			if (target) rawTargets.push(target);
		}
	}

	for (const rawTarget of rawTargets) {
		const target = rawTarget.replaceAll('&amp;', '&');
		if (!target || target.startsWith('#') || /^(?:mailto|tel|data|javascript):/i.test(target)) continue;

		let resolved;
		try {
			resolved = new URL(target, pageUrl);
		} catch {
			problems.add(`${relative}: URL interna no válida ${target}`);
			continue;
		}

		if (resolved.origin !== siteOrigin) continue;
		const expected = pageFile(resolved.pathname);
		if (!fileNames.has(expected)) problems.add(`${relative}: destino interno ausente ${resolved.pathname}`);
	}
}

const sitemap = await readFile(new URL('sitemap-0.xml', distUrl), 'utf8');
const sitemapLocations = new Set(
	[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname),
);
for (const photo of photos) {
	if (!sitemapLocations.has(`/fotografia/${photo.legacyId}/${photo.slug}/`)) {
		problems.add(`sitemap: falta la fotografía ${photo.legacyId}`);
	}
}

const rss = await readFile(new URL('rss.xml', distUrl), 'utf8');
const rssItems = rss.match(/<item>/g)?.length ?? 0;
if (rssItems !== Math.min(24, photos.length)) {
	problems.add(`rss.xml: contiene ${rssItems} entradas; se esperaban ${Math.min(24, photos.length)}`);
}

if (photos.length < 666) problems.add(`catálogo: ${photos.length} fotografías; faltan fotografías del mínimo histórico de 666`);
if (photos.filter((photo) => photo.origin !== 'cms').length !== 666) {
	problems.add('catálogo: el archivo histórico ya no contiene exactamente 666 fotografías');
}

if (problems.size > 0) {
	throw new Error(`Validación de salida fallida:\n- ${[...problems].join('\n- ')}`);
}

const mib = (bytes) => (bytes / 1024 / 1024).toFixed(2);
console.log(
	`Salida OK: ${htmlFiles.length} HTML, ${files.length} archivos, ${mib(totalBytes)} MiB; ` +
	`mayor: ${largest.name} (${mib(largest.bytes)} MiB).`,
);
