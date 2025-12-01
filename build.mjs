#!/usr/bin/env node
import { execSync } from 'child_process';

try {
  console.log('Building frontend...');
  execSync('npx vite build', { stdio: 'inherit' });
  
  console.log('Building backend...');
  execSync(`npx esbuild server/index.prod.ts \
    --platform=node \
    --bundle \
    --format=esm \
    --outfile=dist/index.js \
    --external:express \
    --external:body-parser \
    --external:mysql2 \
    --external:ws \
    --external:@whiskeysockets/baileys \
    --external:pino \
    --external:socket.io \
    --external:nanoid \
    --external:memoizee`, { stdio: 'inherit' });
  
  console.log('Build complete!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
