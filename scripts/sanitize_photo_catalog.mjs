#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(projectRoot, 'src/data/photos.json');
const checkOnly = process.argv.includes('--check');

const emptyStats = () => ({
	escapedQuotes: 0,
	masculineOrdinals: 0,
	feminineOrdinals: 0,
	invertedExclamations: 0,
	invertedQuestions: 0,
	lineEndings: 0,
	trailingWhitespace: 0,
});

const countMatches = (value, pattern) => value.match(pattern)?.length ?? 0;

function sanitizeText(value) {
	const stats = emptyStats();

	stats.escapedQuotes = countMatches(value, /\\"/g);
	stats.masculineOrdinals = countMatches(value, /Âº/g);
	stats.feminineOrdinals = countMatches(value, /Âª/g);
	stats.invertedExclamations = countMatches(value, /Â¡/g);
	stats.invertedQuestions = countMatches(value, /Â¿/g);
	stats.lineEndings = countMatches(value, /\r\n?/g);

	let sanitized = value
		.replace(/\\"/g, '"')
		.replace(/Âº/g, 'º')
		.replace(/Âª/g, 'ª')
		.replace(/Â¡/g, '¡')
		.replace(/Â¿/g, '¿')
		.replace(/\r\n?/g, '\n');

	stats.trailingWhitespace = countMatches(sanitized, /[\t ]+$/gm);
	sanitized = sanitized
		.split('\n')
		.map((line) => line.replace(/[\t ]+$/u, ''))
		.join('\n');

	return { sanitized, stats };
}

function mergeStats(target, source) {
	for (const key of Object.keys(target)) {
		target[key] += source[key];
	}
}

async function main() {
	const source = await readFile(catalogPath, 'utf8');
	const catalog = JSON.parse(source);

	if (!Array.isArray(catalog.photos)) {
		throw new TypeError('El catálogo no contiene un array "photos" válido.');
	}

	const stats = emptyStats();
	const changedPhotos = new Set();
	const changedFields = { title: 0, description: 0 };

	for (const photo of catalog.photos) {
		for (const field of ['title', 'description']) {
			if (typeof photo[field] !== 'string') {
				continue;
			}

			const { sanitized, stats: fieldStats } = sanitizeText(photo[field]);
			mergeStats(stats, fieldStats);

			if (sanitized !== photo[field]) {
				photo[field] = sanitized;
				changedFields[field] += 1;
				changedPhotos.add(photo.legacyId);
			}
		}
	}

	const changedFieldCount = changedFields.title + changedFields.description;
	if (changedFieldCount > 0 && !checkOnly) {
		await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
	}

	const report = {
		catalog: path.relative(projectRoot, catalogPath),
		photosInspected: catalog.photos.length,
		photosChanged: changedPhotos.size,
		fieldsChanged: {
			total: changedFieldCount,
			...changedFields,
		},
		corrections: stats,
		checkOnly,
		fileWritten: changedFieldCount > 0 && !checkOnly,
	};

	console.log(JSON.stringify(report, null, 2));
	if (checkOnly && changedFieldCount > 0) {
		console.error('El catálogo necesita saneado. Ejecuta node scripts/sanitize_photo_catalog.mjs.');
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(`No se pudo sanear el catálogo: ${error.message}`);
	process.exitCode = 1;
});
