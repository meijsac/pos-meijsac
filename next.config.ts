/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["ec-sri-invoice-signer", "xml-crypto", "@xmldom/xmldom", "fast-xml-parser"],
  async headers() {
    const comunes = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Frame-Options", value: "DENY" },
    ]
    return [
      { source: "/:path*", headers: comunes },
      { source: "/dashboard/factura-xml/pdf/:path*", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, ...comunes.slice(0, 2)] },
    ]
  },
};

module.exports = nextConfig;