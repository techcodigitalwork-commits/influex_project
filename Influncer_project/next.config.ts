import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true, // temporary, baad me hata dena
  },

  images: {
    domains: [
      "influex-profile-images.s3.ap-southeast-2.amazonaws.com",
      "api.dicebear.com",
    ],
  },
};

export default nextConfig;

// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   images: {
//     // ✅ domains (purana tarika — kaam karta hai)
//     domains: ["influex-profile-images.s3.ap-southeast-2.amazonaws.com"],

    // ✅ remotePatterns (naya tarika — recommended)
    // remotePatterns: [
    //   {
    //     protocol: "https",
    //     hostname: "influex-profile-images.s3.ap-southeast-2.amazonaws.com",
    //     port: "",
    //     pathname: "/**",
    //   },
    //   // ✅ Dicebear avatars ke liye
    //   {
    //     protocol: "https",
    //     hostname: "api.dicebear.com",
    //     pathname: "/**",
    //   },
    // ],
//   },
// };

// module.exports = nextConfig;



// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// };

// export default nextConfig;


