import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  // Bake admin allowlist into the server runtime for temporary/prebuilt deploys
  env: {
    ADMIN_KICK_USERNAME:
      process.env.ADMIN_KICK_USERNAME ||
      process.env.KICK_CHANNEL_SLUG ||
      "Blakjac21",
  },
  turbopack: {
    root,
  },
  async redirects() {
    return [
      {
        source: "/rewards/stake",
        destination: "/rewards",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
