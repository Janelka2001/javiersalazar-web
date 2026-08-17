import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = new URL('../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('src/data/photos.json', projectRoot), 'utf8'));
const photos = catalog.photos ?? [];
const assetDirectory = new URL('src/assets/photos/', projectRoot);
const assetDirectoryPath = fileURLToPath(assetDirectory);
const expectedNames = photos.map((photo) => photo.image);
const expectedSet = new Set(expectedNames);
const actualNames = (await readdir(assetDirectory)).filter((name) => !name.startsWith('.')).sort();
const actualSet = new Set(actualNames);
const problems = [];

if (photos.length < 666) {
	problems.push(`catálogo: ${photos.length} fotografías; faltan fotografías del mínimo histórico de 666`);
}

const historicalPhotos = photos.filter((photo) => photo.origin !== 'cms');
if (historicalPhotos.length !== 666) {
	problems.push(`catálogo: ${historicalPhotos.length} fotografías históricas; se esperaban 666`);
}

const unsafeNames = expectedNames.filter((name) => typeof name !== 'string' || name !== name.split('/').at(-1) || !/\.jpe?g$/i.test(name));
if (unsafeNames.length > 0) {
	problems.push(`catálogo: ${unsafeNames.length} nombres de imagen no son JPEG basenames seguros`);
}

if (expectedSet.size !== photos.length) {
	problems.push(`catálogo: ${photos.length - expectedSet.size} nombres de imagen duplicados`);
}

const uniqueIds = new Set(photos.map((photo) => photo.legacyId));
if (uniqueIds.size !== photos.length) {
	problems.push(`catálogo: ${photos.length - uniqueIds.size} identificadores duplicados`);
}

const missing = expectedNames.filter((name) => !actualSet.has(name));
const unexpected = actualNames.filter((name) => !expectedSet.has(name));

if (missing.length > 0) {
	problems.push(`assets: faltan ${missing.length} JPEG referenciados`);
}

if (unexpected.length > 0) {
	problems.push(`assets: hay ${unexpected.length} archivos no referenciados`);
}

let totalBytes = 0;
let largest = { name: '', bytes: 0 };
const batchSize = 16;

for (let index = 0; index < actualNames.length; index += batchSize) {
	const batch = actualNames.slice(index, index + batchSize);
	const results = await Promise.all(batch.map(async (name) => {
		const path = join(assetDirectoryPath, name);
		const fileStat = await stat(path);
		const metadata = await sharp(path, { failOn: 'error' }).metadata();
		return { name, bytes: fileStat.size, metadata };
	}));

	for (const result of results) {
		totalBytes += result.bytes;
		if (result.bytes > largest.bytes) largest = { name: result.name, bytes: result.bytes };

		if (result.metadata.format !== 'jpeg') {
			problems.push(`${result.name}: formato ${result.metadata.format ?? 'desconocido'}, se esperaba JPEG`);
		}
		if (!result.metadata.width || !result.metadata.height) {
			problems.push(`${result.name}: dimensiones no válidas`);
		}
		if (result.bytes > 25 * 1024 * 1024) {
			problems.push(`${result.name}: supera 25 MiB`);
		}
	}
}

if (problems.length > 0) {
	throw new Error(`Validación de fotografías fallida:\n- ${problems.join('\n- ')}`);
}

const mib = (bytes) => (bytes / 1024 / 1024).toFixed(2);
console.log(
	`Assets OK: ${actualNames.length} JPEG, ${mib(totalBytes)} MiB; mayor: ${largest.name} (${mib(largest.bytes)} MiB).`,
);
