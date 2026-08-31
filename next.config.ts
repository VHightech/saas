import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ['injured-maddie-imperfectly.ngrok-free.dev'],
  // nodemailer usa require dinamici e binding Node: va lasciato fuori dal bundle
  // del server, altrimenti il tree-shaking di Turbopack ne rompe il caricamento.
  serverExternalPackages: ['nodemailer'],
};

export default nextConfig;
