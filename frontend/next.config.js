/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  output: "export",

  images: {
    unoptimized: true,
  },

  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      "https://rentflow-api-kwcy.onrender.com/api",
  },
};

module.exports = nextConfig;