import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Static export only for Tauri desktop builds (TAURI_BUILD=1)
    // Vercel web deployment does NOT set this — uses default SSR/Edge mode
    ...(process.env.TAURI_BUILD === '1' ? { output: 'export' } : {}),
    // Disable image optimization (not available in static export, keep for consistency)
    images: {
        unoptimized: true,
    },
    webpack: (config) => {
        // pdfjs-dist tries to require('canvas') for Node.js server-side rendering—
        // we only use it in the browser, so alias it to false to prevent build errors.
        config.resolve.alias = {
            ...config.resolve.alias,
            canvas: false,
        };
        return config;
    },
};

export default nextConfig;
