import type { NextConfig } from 'next';

// Workspace packages are consumed as their compiled `dist`; Turbopack has no custom export
// conditions, and Turborepo builds the packages before `next dev` and `next build`.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // No generated AGENTS.md or CLAUDE.md when an AI tool runs `next dev`.
  agentRules: false,
};

export default nextConfig;
