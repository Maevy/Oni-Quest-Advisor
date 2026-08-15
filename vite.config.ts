import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
	version: string;
};

export default defineConfig({
	// SvelteKit's own `version` is a timestamp in dev, so inject the real one.
	define: { __APP_VERSION__: JSON.stringify(pkg.version) },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-node: builds a standalone Node server, deployed to Fly.io.
			adapter: adapter()
		})
	],
	test: {
		environment: 'node',
		include: ['src/**/*.{test,spec}.ts']
	}
});
