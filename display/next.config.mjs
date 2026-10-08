/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  async rewrites() {
    return [{ source: "/", destination: "/landing/index.html" }];
  }
};

export default nextConfig;
