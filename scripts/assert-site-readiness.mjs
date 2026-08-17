import { readFile, readdir } from 'node:fs/promises';
import './load-project-env.mjs';

if (process.env.SITE_READY === 'true') {
	const projectRoot = new URL('../', import.meta.url);
	const catalog = JSON.parse(
		await readFile(new URL('src/data/photos.json', projectRoot), 'utf8'),
	);
	const photos = catalog.photos ?? [];
	const assetNames = new Set(
		await readdir(new URL('src/assets/photos/', projectRoot)),
	);
	const missingAssets = photos.filter((photo) => !assetNames.has(photo.image));
	const expectedAssets = new Set(photos.map((photo) => photo.image));
	const unexpectedAssets = [...assetNames].filter((name) => !expectedAssets.has(name));
	const duplicateIds = photos.filter((photo, index) => photos.findIndex((candidate) => candidate.legacyId === photo.legacyId) !== index);
	const duplicateImages = photos.filter((photo, index) => photos.findIndex((candidate) => candidate.image === photo.image) !== index);
	const routes = photos.map((photo) => `/fotografia/${photo.legacyId}/${photo.slug}/`);
	const duplicateRoutes = routes.filter((route, index) => routes.indexOf(route) !== index);
	const historicalPhotos = photos.filter((photo) => photo.origin !== 'cms');
	const invalidOrigins = photos.filter((photo) => photo.origin !== undefined && !['pixelpost', 'cms'].includes(photo.origin));
	const invalidRoutes = photos.filter((photo) => photo.route !== `/fotografia/${photo.legacyId}/${photo.slug}/`);
	const invalidCmsPhotos = photos.filter((photo) => photo.origin === 'cms' && (
		!photo.title?.trim()
		|| !photo.alt?.trim()
		|| !photo.description?.trim()
		|| !Array.isArray(photo.categories)
		|| photo.categories.length === 0
		|| !/^\d{14}_\d+-[a-z0-9-]+\.jpg$/.test(photo.image)
	));
	const problems = [];

	if (photos.length < 666) {
		problems.push(`el catálogo contiene ${photos.length} fotografías; no puede perder ninguna de las 666 históricas`);
	}

	if (historicalPhotos.length !== 666) {
		problems.push(`el catálogo contiene ${historicalPhotos.length} fotografías históricas; se esperaban exactamente 666`);
	}

	if (invalidOrigins.length > 0) {
		problems.push(`hay ${invalidOrigins.length} fotografías con un origen no válido`);
	}

	if (invalidRoutes.length > 0) {
		problems.push(`hay ${invalidRoutes.length} rutas que no coinciden con su ID y slug`);
	}

	if (invalidCmsPhotos.length > 0) {
		problems.push(`hay ${invalidCmsPhotos.length} fotografías del CMS incompletas o con nombre de imagen inseguro`);
	}

	if (missingAssets.length > 0) {
		problems.push(`faltan ${missingAssets.length} imágenes referenciadas por el catálogo`);
	}

	if (unexpectedAssets.length > 0) {
		problems.push(`hay ${unexpectedAssets.length} archivos no referenciados en src/assets/photos`);
	}

	if (duplicateIds.length > 0) {
		problems.push(`hay ${new Set(duplicateIds.map((photo) => photo.legacyId)).size} identificadores duplicados`);
	}

	if (duplicateImages.length > 0) {
		problems.push(`hay ${new Set(duplicateImages.map((photo) => photo.image)).size} nombres de imagen duplicados`);
	}

	if (duplicateRoutes.length > 0) {
		problems.push(`hay ${new Set(duplicateRoutes).size} rutas fotográficas duplicadas`);
	}

	if (problems.length > 0) {
		throw new Error(
			`No se puede compilar una versión indexable: ${problems.join('; ')}. ` +
			'Mantén SITE_READY=false hasta completar la migración.',
		);
	}
}
