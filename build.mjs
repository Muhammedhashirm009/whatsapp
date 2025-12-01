#!/usr/bin/env node
import { execSync } from 'child_process';

try {
  console.log('Building frontend...');
  execSync('vite build', { stdio: 'inherit' });
  
  console.log('Building backend with bundled dependencies...');
  execSync('esbuild server/index.ts --platform=node --packages=bundle --bundle --format=esm --outdir=dist', { stdio: 'inherit' });
  
  console.log('Build complete!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
