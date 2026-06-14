/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ปิดการแจ้งเตือน ESLint ตอน Build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ปิดการแจ้งเตือน TypeScript ตอน Build
    ignoreBuildErrors: true,
  },
};

export default nextConfig;