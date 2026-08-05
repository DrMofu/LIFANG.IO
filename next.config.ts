import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack(config) {
    // cubing/search intentionally uses runtime module resolution and a Worker fallback graph.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /node_modules[\\/]cubing[\\/].*chunk-YLS2ZYML\.js$/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
      /Circular dependency between chunks with runtime \(\d+, (?:webpack|webpack-runtime)\)/,
    ];

    return config;
  },
};

export default nextConfig;
