import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@neondatabase/serverless", "@electric-sql/pglite"],
  poweredByHeader: false,
  outputFileTracingExcludes: {
    "/*": ["./.env*", "./data/**/*", "./.maestri/**/*", "./.impeccable/**/*"],
  },
  experimental: { serverActions: { bodySizeLimit: "32kb" } },
};
export default config;
