/** @type {import('next').NextConfig} **/

const nextConfig = {
    experimental: {
        serverComponentsExternalPackages: ['@prisma/client', 'argon2']
    }
}

module.exports = nextConfig;