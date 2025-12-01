#!/usr/bin/env node
import { execSync } from 'child_process';

try {
  console.log('Building frontend...');
  execSync('npx vite build', { stdio: 'inherit' });
  
  console.log('Building backend with bundled dependencies...');
  execSync(`npx esbuild server/index.prod.ts \
    --platform=node \
    --packages=bundle \
    --bundle \
    --format=esm \
    --outfile=dist/index.js`, { stdio: 'inherit' });
  
  console.log('Build complete!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
