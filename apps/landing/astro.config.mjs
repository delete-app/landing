// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://trydelete.app',
	integrations: [
		starlight({
			title: 'Delete Learn',
			description: 'Research-backed relationship education. Understand yourself, attraction, compatibility, and how to build lasting connections — with peer-reviewed sources.',
			logo: {
				light: './src/assets/logo-light.svg',
				dark: './src/assets/logo-dark.svg',
				replacesTitle: true,
			},
			social: {
				instagram: 'https://instagram.com/trydelete.app',
				'x.com': 'https://twitter.com/trydeleteapp',
			},
			// Force dark mode only - hide theme selector
			components: {
				ThemeProvider: './src/components/ForceDarkTheme.astro',
				ThemeSelect: './src/components/EmptyComponent.astro',
			},
			customCss: ['./src/styles/custom.css'],
			sidebar: [
				{
					label: 'Start Here',
					items: [
						{ label: 'Welcome', slug: 'learn' },
					],
				},
				{
					label: 'Module 1: Know Yourself First',
					autogenerate: { directory: 'learn/module-1-know-yourself' },
				},
				{
					label: 'Module 2: The Science of Attraction',
					autogenerate: { directory: 'learn/module-2-attraction' },
				},
				{
					label: 'Module 3: Compatibility Decoded',
					autogenerate: { directory: 'learn/module-3-compatibility' },
				},
				{
					label: 'Module 4: The Neurodivergent Lens',
					autogenerate: { directory: 'learn/module-4-neurodivergent' },
				},
				{
					label: 'Module 5: Building Something Real',
					autogenerate: { directory: 'learn/module-5-building-real' },
				},
			],
			head: [
				// Favicon
				{
					tag: 'link',
					attrs: {
						rel: 'icon',
						type: 'image/x-icon',
						href: '/favicon.ico',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'icon',
						type: 'image/png',
						sizes: '32x32',
						href: '/favicon-32x32.png',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'icon',
						type: 'image/png',
						sizes: '16x16',
						href: '/favicon-16x16.png',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'apple-touch-icon',
						sizes: '180x180',
						href: '/apple-touch-icon.png',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'manifest',
						href: '/site.webmanifest',
					},
				},
				// Open Graph
				{
					tag: 'meta',
					attrs: {
						property: 'og:type',
						content: 'website',
					},
				},
				{
					tag: 'meta',
					attrs: {
						property: 'og:site_name',
						content: 'Delete Learn',
					},
				},
				{
					tag: 'meta',
					attrs: {
						property: 'og:image',
						content: 'https://trydelete.app/og-image.svg',
					},
				},
				// Twitter Card
				{
					tag: 'meta',
					attrs: {
						name: 'twitter:card',
						content: 'summary_large_image',
					},
				},
				{
					tag: 'meta',
					attrs: {
						name: 'twitter:site',
						content: '@trydeleteapp',
					},
				},
				{
					tag: 'meta',
					attrs: {
						name: 'twitter:image',
						content: 'https://trydelete.app/og-image.svg',
					},
				},
			],
			disable404Route: true,
		}),
	],
});
