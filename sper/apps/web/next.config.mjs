import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sper/shared-types'],
  // A stray pnpm-lock.yaml higher up on this machine confuses Next's
  // workspace-root inference — pin it explicitly to this repo.
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
