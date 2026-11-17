import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@libsql/client"],
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "32kb" } },
};
export default config;
