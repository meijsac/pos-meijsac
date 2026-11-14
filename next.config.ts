/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["ec-sri-invoice-signer", "xml-crypto", "@xmldom/xmldom", "fast-xml-parser", "node-forge", "xmllint-wasm"],
  async headers() {
    const comunes = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "default-src 'self'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'" },
    ]
    return [
      { source: "/:path*", headers: comunes },
      { source: "/dashboard/factura-xml/pdf/:path*", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, ...comunes.slice(0, 2)] },
    ]
  },
};

module.exports = nextConfig;