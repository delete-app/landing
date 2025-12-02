// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Delete Learn',
			description: 'Relationship education, the Zerodha Varsity way. Research-backed, no fluff.',
			social: [
				{ icon: 'instagram', label: 'Instagram', href: 'https://instagram.com/trydelete.app' },
				{ icon: 'x.com', label: 'X', href: 'https://twitter.com/trydeleteapp' },
			],
			customCss: ['./src/styles/custom.css'],
			sidebar: [
				{
					label: 'Start Here',
					items: [
						{ label: 'Welcome', slug: 'index' },
					],
				},
				{
					label: 'Module 1: Know Yourself First',
					autogenerate: { directory: 'module-1-know-yourself' },
				},
				{
					label: 'Module 2: The Science of Attraction',
					autogenerate: { directory: 'module-2-attraction' },
				},
				{
					label: 'Module 4: The Neurodivergent Lens',
					autogenerate: { directory: 'module-4-neurodivergent' },
				},
			],
			head: [
				{
					tag: 'link',
					attrs: {
						rel: 'icon',
						href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>×</text></svg>",
					},
				},
			],
		}),
	],
});
