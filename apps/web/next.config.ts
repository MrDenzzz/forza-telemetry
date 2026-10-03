import path from 'node:path';

import type { NextConfig } from 'next';

// Workspace packages are consumed as their compiled `dist`; Turbopack has no custom export
// conditions, and Turborepo builds the packages before `next dev` and `next build`.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // No generated AGENTS.md or CLAUDE.md when an AI tool runs `next dev`.
  agentRules: false,
  // A self-contained server for the Docker image, traced from the workspace root so that the
  // workspace packages it uses are included.
  output: 'standalone',
  outputFileTracingRoot: path.resolve(import.meta.dirname, '../..'),
};

export default nextConfig;
