import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
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
