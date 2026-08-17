import photoCatalog from '../data/photos.json';
import type { Photo } from './photos';

export const GALLERY_PAGE_SIZE = 24;

export interface ArchiveLink {
	slug: string;
	label: string;
	count: number;
}

export interface YearLink {
	year: string;
	count: number;
}

export interface ArchiveNavigationData {
	categories: ArchiveLink[];
	years: YearLink[];
}

export interface PhotoPage {
	data: Photo[];
	currentPage: number;
	lastPage: number;
	total: number;
	start: number;
	end: number;
	url: {
		current: string;
		prev?: string;
		next?: string;
	};
}

const categoryNames = new Map(
	photoCatalog.categories.map((category) => [category.slug, category.name]),
);
const spanishCollator = new Intl.Collator('es', { sensitivity: 'base' });

export function categoryLabel(slug: string): string {
	return categoryNames.get(slug)
		?? slug.replaceAll('-', ' ').replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function paginatedHref(baseHref: string, pageNumber: number): string {
	return pageNumber <= 1 ? baseHref : `${baseHref}${pageNumber}/`;
}

export function paginatePhotos(
	photos: Photo[],
	baseHref: string,
	pageSize = GALLERY_PAGE_SIZE,
): PhotoPage[] {
	const total = photos.length;
	const lastPage = Math.max(1, Math.ceil(total / pageSize));

	return Array.from({ length: lastPage }, (_, index) => {
		const currentPage = index + 1;
		const start = index * pageSize;
		const data = photos.slice(start, start + pageSize);

		return {
			data,
			currentPage,
			lastPage,
			total,
			start,
			end: data.length > 0 ? start + data.length - 1 : start,
			url: {
				current: paginatedHref(baseHref, currentPage),
				prev: currentPage > 1 ? paginatedHref(baseHref, currentPage - 1) : undefined,
				next: currentPage < lastPage ? paginatedHref(baseHref, currentPage + 1) : undefined,
			},
		};
	});
}

export function buildArchiveNavigation(photos: Photo[]): ArchiveNavigationData {
	const categoryCounts = new Map<string, number>();
	const yearCounts = new Map<string, number>();

	for (const photo of photos) {
		for (const category of photo.categories) {
			categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
		}

		const year = photo.publishedAtLegacy.slice(0, 4);
		yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
	}

	const categories = Array.from(categoryCounts, ([slug, count]) => ({
		slug,
		label: categoryLabel(slug),
		count,
	})).sort((a, b) => b.count - a.count || spanishCollator.compare(a.label, b.label));

	const years = Array.from(yearCounts, ([year, count]) => ({ year, count }))
		.sort((a, b) => b.year.localeCompare(a.year));

	return { categories, years };
}
