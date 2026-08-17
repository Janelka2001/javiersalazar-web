import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

const photos = defineCollection({
	loader: file('src/data/photos.json', {
		parser: (text) => {
			const catalog = JSON.parse(text) as { photos: Array<Record<string, unknown> & { legacyId: number }> };

			return catalog.photos.map((photo) => ({
				...photo,
				id: String(photo.legacyId),
			}));
		},
	}),
	schema: z.object({
		legacyId: z.number().int().positive(),
		slug: z.string().min(1),
		title: z.string().min(1),
		description: z.string(),
		alt: z.string().min(1).optional(),
		origin: z.enum(['pixelpost', 'cms']).optional(),
		publishedAtLegacy: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
		image: z.string().min(1),
		legacyImage: z.string().min(1),
		exif: z.object({
			make: z.string().optional(),
			model: z.string().optional(),
			focalLength: z.string().optional(),
			aperture: z.string().optional(),
			exposure: z.string().optional(),
			iso: z.string().optional(),
			capturedAtLegacy: z.string().optional(),
			orientation: z.string().optional(),
			exifWidth: z.string().optional(),
			exifHeight: z.string().optional(),
		}),
		route: z.string().startsWith('/fotografia/'),
		categories: z.array(z.string()),
		tags: z.array(z.string()),
	}),
});

export const collections = { photos };
