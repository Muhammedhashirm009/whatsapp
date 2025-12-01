#!/usr/bin/env node
import { execSync } from 'child_process';

try {
  console.log('Building frontend...');
  execSync('npx vite build', { stdio: 'inherit' });
  
  console.log('Building backend with bundled dependencies...');
  execSync(`npx esbuild server/index.ts \
    --platform=node \
    --packages=bundle \
    --bundle \
    --format=cjs \
    --outfile=dist/index.cjs \
    --external:@babel/preset-typescript \
    --external:lightningcss \
    --external:@tailwindcss/vite \
    --external:vite`, { stdio: 'inherit' });
  
  console.log('Build complete!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
