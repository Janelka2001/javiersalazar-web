import { createHash } from 'node:crypto';
import { readFile, readdir, stat, unlink } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = new URL('../', import.meta.url);
const sourceDirectory = new URL('src/assets/photos/', projectRoot);
const distDirectory = new URL('dist/', projectRoot);
const astroDirectory = new URL('_astro/', distDirectory);
const sourceDirectoryPath = fileURLToPath(sourceDirectory);
const distDirectoryPath = fileURLToPath(distDirectory);
const astroDirectoryPath = fileURLToPath(astroDirectory);
const textOutputPattern = /\.(?:css|html|js|json|map|mjs|svg|txt|webmanifest|xml)$/i;
const jpegPattern = /\.jpe?g$/i;
const astroReferencePattern = /\/_astro\/([^\s"'<>),]+)/gu;

async function listFiles(directoryPath) {
	const entries = await readdir(directoryPath, { withFileTypes: true });
	const nested = await Promise.all(entries.map(async (entry) => {
		const path = join(directoryPath, entry.name);
		return entry.isDirectory() ? listFiles(path) : [path];
	}));
	return nested.flat();
}

async function sha256(path) {
	return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function referencedAstroFiles(outputFiles) {
	const references = new Set();

	for (const path of outputFiles.filter((file) => (
		textOutputPattern.test(file)
		|| basename(file) === '_headers'
		|| basename(file) === '_redirects'
	))) {
		const output = await readFile(path, 'utf8');
		for (const match of output.matchAll(astroReferencePattern)) {
			try {
				const decoded = decodeURIComponent(match[1]).split(/[?#]/u, 1)[0];
				references.add(decoded);
			} catch {
				// Una URL mal codificada la detectará la validación general de salida.
			}
		}
	}

	return references;
}

export async function findUnreferencedPhotoOriginals() {
	const [sourceFiles, outputFiles, astroFiles] = await Promise.all([
		listFiles(sourceDirectoryPath),
		listFiles(distDirectoryPath),
		listFiles(astroDirectoryPath),
	]);
	const sourceJpegs = sourceFiles.filter((file) => jpegPattern.test(file));
	const sourceHashes = new Set();
	for (const path of sourceJpegs) sourceHashes.add(await sha256(path));
	const references = await referencedAstroFiles(outputFiles);
	const unreferencedJpegs = astroFiles.filter((file) => (
		jpegPattern.test(file)
		&& !references.has(relative(astroDirectoryPath, file))
	));
	const matches = [];

	for (const path of unreferencedJpegs) {
		if (sourceHashes.has(await sha256(path))) {
			matches.push({ path, bytes: (await stat(path)).size });
		}
	}

	return matches;
}

async function main() {
	const originals = await findUnreferencedPhotoOriginals();
	await Promise.all(originals.map((original) => unlink(original.path)));
	const bytes = originals.reduce((total, original) => total + original.bytes, 0);
	console.log(
		`Salida optimizada: ${originals.length} originales Astro sin referencias eliminados `
		+ `(${(bytes / 1024 / 1024).toFixed(2)} MiB).`,
	);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) await main();
