import type { CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';

export type PhotoEntry = CollectionEntry<'photos'>;
export type Photo = PhotoEntry['data'] & { asset: ImageMetadata };

const assetModules = import.meta.glob<{ default: ImageMetadata }>('/src/assets/photos/*', {
	eager: true,
});

const assetsByFilename = new Map(
	Object.entries(assetModules).map(([path, module]) => [path.split('/').at(-1), module.default]),
);

export function preparePhotos(entries: PhotoEntry[]): Photo[] {
	const missingAssets = entries.filter((entry) => !assetsByFilename.has(entry.data.image));

	if (missingAssets.length > 0) {
		const sample = missingAssets.slice(0, 5).map((entry) => entry.data.image).join(', ');
		throw new Error(
			`Faltan ${missingAssets.length} imágenes del catálogo en src/assets/photos` +
			(sample ? `: ${sample}${missingAssets.length > 5 ? ', …' : ''}` : ''),
		);
	}

	return entries
		.map((entry) => ({
			...entry.data,
			asset: assetsByFilename.get(entry.data.image)!,
		}))
		.sort((a, b) => b.publishedAtLegacy.localeCompare(a.publishedAtLegacy));
}

export function photoHref(photo: Pick<Photo, 'legacyId' | 'slug'>): string {
	return `/fotografia/${photo.legacyId}/${photo.slug}/`;
}

export function formatLegacyDate(value: string): string {
	const [date] = value.split(' ');
	const [year, month, day] = date.split('-').map(Number);

	return new Intl.DateTimeFormat('es-ES', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC',
	}).format(new Date(Date.UTC(year, month - 1, day)));
}

export function legacyDateTime(value: string): string {
	return value.replace(' ', 'T');
}
