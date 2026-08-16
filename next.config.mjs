/** @type {import('next').NextConfig} */
const nextConfig = {
  // The panel route holds an SSE connection open while several model calls run.
  experimental: { proxyTimeout: 300_000 },
};

export default nextConfig;
