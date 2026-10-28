import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Normalize Windows paths so Vite recognizes HTML entry points during builds.
const entry = (name: string) => fileURLToPath(new URL(name, import.meta.url)).replace(/\\/g, '/');

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: [entry('index.html'), entry('editor.html')],
    },
  },
});
