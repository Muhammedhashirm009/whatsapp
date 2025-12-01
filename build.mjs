#!/usr/bin/env node
import { execSync } from 'child_process';

const esmShim = `
import { createRequire as _createRequire } from 'module';
import { fileURLToPath as _fileURLToPath } from 'url';
import { dirname as _dirname } from 'path';
const require = _createRequire(import.meta.url);
const __filename = _fileURLToPath(import.meta.url);
const __dirname = _dirname(__filename);
`;

try {
  console.log('Building frontend...');
  execSync('npx vite build', { stdio: 'inherit' });
  
  console.log('Building backend with bundled dependencies...');
  const banner = esmShim.replace(/\n/g, '');
  execSync(`npx esbuild server/index.ts \
    --platform=node \
    --packages=bundle \
    --bundle \
    --format=esm \
    --outfile=dist/index.js \
    --banner:js="${banner}" \
    --external:@babel/preset-typescript \
    --external:lightningcss \
    --external:@tailwindcss/vite \
    --external:vite \
    --external:@replit/vite-plugin-cartographer \
    --external:@replit/vite-plugin-dev-banner \
    --external:@replit/vite-plugin-runtime-error-modal`, { stdio: 'inherit' });
  
  console.log('Build complete!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
