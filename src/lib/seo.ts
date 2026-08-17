import type { Photo } from './photos';

export const siteReadyForIndexing = import.meta.env.SITE_READY === 'true';

export function seoText(value: string): string {
	return value
		.replace(/\\(["'])/g, '$1')
		.replaceAll('Âº', 'º')
		.replaceAll('Âª', 'ª')
		.replace(/\s+/g, ' ')
		.trim();
}

export function seoDescription(value: string | undefined, fallback: string, maxLength = 155): string {
	const description = seoText(value?.trim() || fallback);

	if (description.length <= maxLength) {
		return description;
	}

	const candidate = description.slice(0, maxLength - 1);
	const lastSpace = candidate.lastIndexOf(' ');
	const cutAt = lastSpace > maxLength * 0.7 ? lastSpace : candidate.length;

	return `${candidate.slice(0, cutAt).replace(/[\s,;:.!?-]+$/g, '')}…`;
}

interface PhotoStructuredDataOptions {
	photo: Photo;
	pageUrl: URL;
	imageUrl: URL;
	imageWidth: number;
	imageHeight: number;
}

export function photoStructuredData({
	photo,
	pageUrl,
	imageUrl,
	imageWidth,
	imageHeight,
}: PhotoStructuredDataOptions): Array<Record<string, unknown>> {
	const siteUrl = new URL('/', pageUrl);
	const pageId = `${pageUrl.href}#webpage`;
	const imageId = `${pageUrl.href}#fotografia`;
	const personId = `${siteUrl.href}#javier-salazar`;
	const title = seoText(photo.title);
	const sourceDescription = seoText(photo.description);
	const pageDescription = seoDescription(
		photo.description,
		`“${title}”, fotografía de Javier Salazar.`,
		300,
	);
	const isHomepage = pageUrl.pathname === '/';
	const breadcrumbId = `${pageUrl.href}#migas-de-pan`;

	const webPage: Record<string, unknown> = {
		'@type': 'WebPage',
		'@id': pageId,
		url: pageUrl.href,
		name: `${title} · Javier Salazar`,
		description: pageDescription,
		inLanguage: 'es',
		isPartOf: { '@id': `${siteUrl.href}#website` },
		primaryImageOfPage: { '@id': imageId },
		mainEntity: { '@id': imageId },
		datePublished: photo.publishedAtLegacy.slice(0, 10),
	};

	if (!isHomepage) {
		webPage.breadcrumb = { '@id': breadcrumbId };
	}

	const nodes: Array<Record<string, unknown>> = [
		webPage,
		{
			'@type': 'ImageObject',
			'@id': imageId,
			contentUrl: imageUrl.href,
			url: pageUrl.href,
			name: title,
			caption: sourceDescription || title,
			...(sourceDescription ? { description: seoDescription(sourceDescription, sourceDescription, 300) } : {}),
			encodingFormat: 'image/jpeg',
			width: imageWidth,
			height: imageHeight,
			datePublished: photo.publishedAtLegacy.slice(0, 10),
			creator: { '@id': personId },
			copyrightHolder: { '@id': personId },
			creditText: 'Javier Salazar',
			copyrightNotice: '© Javier Salazar. Todos los derechos reservados.',
			representativeOfPage: true,
			mainEntityOfPage: { '@id': pageId },
		},
	];

	if (!isHomepage) {
		nodes.push({
			'@type': 'BreadcrumbList',
			'@id': breadcrumbId,
			itemListElement: [
				{
					'@type': 'ListItem',
					position: 1,
					name: 'Inicio',
					item: siteUrl.href,
				},
				{
					'@type': 'ListItem',
					position: 2,
					name: 'Galería',
					item: new URL('/galeria/', siteUrl).href,
				},
				{
					'@type': 'ListItem',
					position: 3,
					name: title,
					item: pageUrl.href,
				},
			],
		});
	}

	return nodes;
}

export function legacyPublicationDate(value: string): Date {
	const [date] = value.split(' ');
	const [year, month, day] = date.split('-').map(Number);

	return new Date(Date.UTC(year, month - 1, day, 12));
}
