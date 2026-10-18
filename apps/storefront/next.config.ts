import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: [
    "@innovia/types",
    "@innovia/api-client",
    "@innovia/validation",
  ],
  poweredByHeader: false,
  devIndicators: false,
};
export default config;
