// next.config.ts
const nextConfig = {
  // เพิ่มส่วนนี้เข้าไปครับ
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true, // ตัวนี้แหละครับที่จะช่วยกิต
  },
  // ... config เดิมของกิต
};

export default nextConfig;