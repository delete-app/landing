// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import AstroPWA from '@vite-pwa/astro';

// https://astro.build/config
export default defineConfig({
	site: 'https://trydelete.app',
	redirects: {
		// Module 1: Know Yourself
		'/learn/module-1-know-yourself/1-why-self-awareness-matters': '/learn/know-yourself/why-self-awareness-matters',
		'/learn/module-1-know-yourself/2-your-attachment-style': '/learn/know-yourself/your-attachment-style',
		'/learn/module-1-know-yourself/3-how-you-handle-conflict': '/learn/know-yourself/how-you-handle-conflict',
		'/learn/module-1-know-yourself/4-your-emotional-needs': '/learn/know-yourself/your-emotional-needs',
		'/learn/module-1-know-yourself/5-your-relationship-with-yourself': '/learn/know-yourself/your-relationship-with-yourself',
		// Module 2: Attraction
		'/learn/module-2-attraction/1-limerence-vs-love': '/learn/attraction/limerence-vs-love',
		'/learn/module-2-attraction/2-the-chemistry-of-love': '/learn/attraction/the-chemistry-of-love',
		'/learn/module-2-attraction/3-physical-attraction': '/learn/attraction/physical-attraction',
		'/learn/module-2-attraction/4-online-dating': '/learn/attraction/online-dating',
		'/learn/module-2-attraction/5-from-attraction-to-relationship': '/learn/attraction/from-attraction-to-relationship',
		// Module 3: Compatibility
		'/learn/module-3-compatibility/1-beyond-having-things-in-common': '/learn/compatibility/beyond-having-things-in-common',
		'/learn/module-3-compatibility/2-values-alignment': '/learn/compatibility/values-alignment',
		'/learn/module-3-compatibility/3-life-rhythm-compatibility': '/learn/compatibility/life-rhythm-compatibility',
		'/learn/module-3-compatibility/4-conflict-styles': '/learn/compatibility/conflict-styles',
		'/learn/module-3-compatibility/5-growth-trajectories': '/learn/compatibility/growth-trajectories',
		// Module 4: Neurodivergent
		'/learn/module-4-neurodivergent/1-adhd-in-relationships': '/learn/neurodivergent/adhd-in-relationships',
		'/learn/module-4-neurodivergent/2-autism-and-intimacy': '/learn/neurodivergent/autism-and-intimacy',
		'/learn/module-4-neurodivergent/3-anxiety-and-dating': '/learn/neurodivergent/anxiety-and-dating',
		'/learn/module-4-neurodivergent/4-dating-someone-neurodivergent': '/learn/neurodivergent/dating-someone-neurodivergent',
		'/learn/module-4-neurodivergent/5-bipolar-in-relationships': '/learn/neurodivergent/bipolar-in-relationships',
		'/learn/module-4-neurodivergent/6-bpd-in-relationships': '/learn/neurodivergent/bpd-in-relationships',
		// Module 5: Building Real
		'/learn/module-5-building-real/1-what-makes-relationships-last': '/learn/building-real/what-makes-relationships-last',
		'/learn/module-5-building-real/2-communication-that-actually-works': '/learn/building-real/communication-that-actually-works',
		'/learn/module-5-building-real/3-navigating-conflict': '/learn/building-real/navigating-conflict',
		'/learn/module-5-building-real/4-maintaining-intimacy': '/learn/building-real/maintaining-intimacy',
		'/learn/module-5-building-real/5-when-to-walk-away': '/learn/building-real/when-to-walk-away',
		'/learn/module-5-building-real/6-relationship-pacing': '/learn/building-real/relationship-pacing',
		'/learn/module-5-building-real/7-why-people-lose-interest': '/learn/building-real/why-people-lose-interest',
		// Module 6: Staying Together
		'/learn/module-6-staying-together/0-three-phases-of-love': '/learn/staying-together/three-phases-of-love',
		'/learn/module-6-staying-together/1-maintaining-intimacy': '/learn/staying-together/maintaining-intimacy',
		'/learn/module-6-staying-together/2-gottman-principles': '/learn/staying-together/gottman-principles',
		'/learn/module-6-staying-together/3-growing-together': '/learn/staying-together/growing-together',
		'/learn/module-6-staying-together/4-life-transitions': '/learn/staying-together/life-transitions',
		'/learn/module-6-staying-together/4a-pregnancy-as-partners': '/learn/staying-together/pregnancy-as-partners',
		'/learn/module-6-staying-together/5-maintenance-rituals': '/learn/staying-together/maintenance-rituals',
		'/learn/module-6-staying-together/6-when-to-seek-help': '/learn/staying-together/when-to-seek-help',
		// Module 7: Communication
		'/learn/module-7-communication/1-the-art-of-questions': '/learn/communication/the-art-of-questions',
		'/learn/module-7-communication/2-perceived-partner-responsiveness': '/learn/communication/perceived-partner-responsiveness',
		'/learn/module-7-communication/3-active-listening': '/learn/communication/active-listening',
		'/learn/module-7-communication/4-text-communication': '/learn/communication/text-communication',
		'/learn/module-7-communication/5-first-date-conversations': '/learn/communication/first-date-conversations',
	},
	integrations: [
		react(),
		AstroPWA({
			mode: 'production',
			includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'favicon-32x32.png', 'favicon-16x16.png'],
			registerType: 'autoUpdate',
			injectRegister: 'auto',
			manifest: {
				name: 'Delete Learn',
				short_name: 'Delete Learn',
				description: 'Research-backed relationship education. Understand yourself, attraction, compatibility, and how to build lasting connections.',
				theme_color: '#0a0a0a',
				background_color: '#0a0a0a',
				display: 'standalone',
				start_url: '/learn/',
				scope: '/learn/',
				icons: [
					{
						src: '/android-chrome-192x192.png',
						sizes: '192x192',
						type: 'image/png',
					},
					{
						src: '/android-chrome-512x512.png',
						sizes: '512x512',
						type: 'image/png',
					},
					{
						src: '/android-chrome-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
			workbox: {
				globPatterns: ['**/*.{css,js,html,svg,png,ico,txt,woff,woff2}'],
				navigateFallbackDenylist: [/^\/(?!learn)/], // Only allow /learn/* for offline
			},
			devOptions: {
				enabled: false,
			},
		}),
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
					label: 'Know Yourself First',
					autogenerate: { directory: 'learn/know-yourself' },
				},
				{
					label: 'The Science of Attraction',
					autogenerate: { directory: 'learn/attraction' },
				},
				{
					label: 'Compatibility Decoded',
					autogenerate: { directory: 'learn/compatibility' },
				},
				{
					label: 'The Neurodivergent Lens',
					autogenerate: { directory: 'learn/neurodivergent' },
				},
				{
					label: 'Building Something Real',
					autogenerate: { directory: 'learn/building-real' },
				},
				{
					label: 'Staying Together',
					autogenerate: { directory: 'learn/staying-together' },
				},
				{
					label: 'Communication Mastery',
					autogenerate: { directory: 'learn/communication' },
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
				// PWA manifest
				{
					tag: 'link',
					attrs: {
						rel: 'manifest',
						href: '/manifest.webmanifest',
					},
				},
				// PWA service worker registration
				{
					tag: 'script',
					attrs: {
						src: '/registerSW.js',
						defer: true,
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
