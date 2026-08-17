import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { photoHref, preparePhotos } from '../lib/photos';
import { legacyPublicationDate, seoDescription, seoText } from '../lib/seo';

export const GET: APIRoute = async (context) => {
	const photos = preparePhotos(await getCollection('photos')).slice(0, 24);

	return rss({
		title: 'Javier Salazar · El mundo a través de mis ojos',
		description: 'Últimas fotografías publicadas por Javier Salazar.',
		site: context.site!,
		items: photos.map((photo) => ({
			title: seoText(photo.title),
			description: seoDescription(
				photo.description,
				`“${seoText(photo.title)}”, fotografía de Javier Salazar.`,
				300,
			),
			pubDate: legacyPublicationDate(photo.publishedAtLegacy),
			link: photoHref(photo),
			categories: photo.categories,
		})),
		customData: '<language>es</language><copyright>© Javier Salazar. Todos los derechos reservados.</copyright>',
	});
};
