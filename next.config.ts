import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/manager",
        destination: "/login",
        permanent: false,
      },
      {
        source: "/partial-invoices",
        destination: "/invoices",
        permanent: false,
      },
      {
        source: "/partial-invoices/:path*",
        destination: "/invoices/:path*",
        permanent: false,
      },
      {
        source: "/gallery",
        destination: "/reports",
        permanent: false,
      },
      {
        source: "/worker",
        destination: "/field",
        permanent: false,
      },
      {
        source: "/worker/:path*",
        destination: "/field",
        permanent: false,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
