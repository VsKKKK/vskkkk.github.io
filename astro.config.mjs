import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://vskkkk.github.io',
  output: 'static',
  trailingSlash: 'always',
  redirects: { '/work': '/#works' },
});
