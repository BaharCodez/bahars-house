/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: (config) => {
    config.externals = [...(config.externals ?? []), { canvas: "canvas" }];
    return config;
  },
};

module.exports = nextConfig;
