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
	server: {
		watch: {
			// Neither folder is imported by the app — `data-import/` is read only by
			// scripts/importUnits.mjs, and `.qwen/` is local tooling state — but both sit inside the
			// project root, so Vite watched them by proximity. That cost a crash: a producer export
			// being written to data-import/ while chokidar tried to watch it gave EBUSY, which
			// chokidar emits as an unhandled FSWatcher 'error' event and takes the dev process down.
			// Writes under .qwen/ were merely disruptive, full-page-reloading every connected browser
			// and dropping mid-journey verification harnesses back to the startup prompt.
			ignored: ['**/data-import/**', '**/.qwen/**']
		}
	},
	test: {
		environment: 'node',
		include: ['src/**/*.{test,spec}.ts']
	}
});
