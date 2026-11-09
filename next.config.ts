/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["ec-sri-invoice-signer", "xml-crypto", "@xmldom/xmldom", "fast-xml-parser"],
};

module.exports = nextConfig;