import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack does not walk up into the user's
  // home directory looking for a lockfile.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
