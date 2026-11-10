/** @type {import('next').NextConfig} */
const nextConfig = {
  // pg is a server-only package; keep it out of the bundle.
  serverExternalPackages: ['pg'],
};
export default nextConfig;
