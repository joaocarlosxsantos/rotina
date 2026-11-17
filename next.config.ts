import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const nodeModulesPath = path.join(__dirname, "node_modules");
const usesLinkedNodeModules =
  fs.existsSync(nodeModulesPath) && fs.lstatSync(nodeModulesPath).isSymbolicLink();

const config: NextConfig = {
  ...(usesLinkedNodeModules ? { turbopack: { root: path.join(__dirname, "..") } } : {}),
  serverExternalPackages: ["@neondatabase/serverless", "@electric-sql/pglite"],
  poweredByHeader: false,
  outputFileTracingExcludes: {
    "/*": ["./.env*", "./data/**/*", "./.maestri/**/*", "./.impeccable/**/*"],
  },
  experimental: { serverActions: { bodySizeLimit: "32kb" } },
};
export default config;
