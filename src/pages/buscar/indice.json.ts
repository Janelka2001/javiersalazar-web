import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { categoryLabel } from '../../lib/galleryArchive';
import { photoHref } from '../../lib/photos';
import { seoText } from '../../lib/seo';

export const prerender = true;

export const GET: APIRoute = async () => {
	const entries = await getCollection('photos');
	const photos = entries
		.map(({ data: photo }) => ({
			href: photoHref(photo),
			title: seoText(photo.title),
			description: seoText(photo.description),
			year: photo.publishedAtLegacy.slice(0, 4),
			categories: photo.categories.map(categoryLabel),
			tags: photo.tags.map(seoText),
			publishedAt: photo.publishedAtLegacy,
		}))
		.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

	return new Response(JSON.stringify({ photos }), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'public, max-age=0, must-revalidate',
		},
	});
};
