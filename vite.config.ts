import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide'
		})
	],
	server: {
		proxy: {
			// Proxy API requests to Cloudflare Worker dev server
			'/api': {
				target: 'http://localhost:8787', // Default wrangler dev port
				changeOrigin: true,
			},
			'/webhook': {
				target: 'http://localhost:8787',
				changeOrigin: true,
			}
		}
	}
});
