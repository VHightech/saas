import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ['injured-maddie-imperfectly.ngrok-free.dev'],
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  // The admin upload route uses path.join(process.cwd(), …) at runtime to
  // locate 7zip-bin and write/read tmp files; Turbopack's tracer (NFT) flags
  // this as "the whole project may be needed" and pulls next.config.ts into
  // the function bundle. Explicitly exclude that file from this route's trace.
  outputFileTracingExcludes: {
    '/api/upload': ['./next.config.ts'],
  },
};

export default nextConfig;
