import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ['injured-maddie-imperfectly.ngrok-free.dev'],
  experimental: {
    serverActions: {
      // Server Actions only carry small form payloads (login, register,
      // password reset, admin edits). Keep this tight: a high limit is a DoS
      // amplifier on unauthenticated actions. Large file ingestion does NOT
      // pass through here — it uses the /api/upload and /api/upload-users Route
      // Handlers (req.formData()), which are not governed by this setting.
      bodySizeLimit: '2mb',
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
