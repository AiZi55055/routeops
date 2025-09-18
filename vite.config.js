import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            workbox: {
                navigateFallbackAllowlist: [/^\/$/, /^\/messenger/, /^\/dashboard/, /^\/optimize/]
            },
            manifest: {
                name: 'Messenger Waypoint',
                short_name: 'Waypoint',
                start_url: '/',
                display: 'standalone',
                background_color: '#111827',
                theme_color: '#111827',
                icons: [
                    { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' }
                ]
            }
        })
    ],
    resolve: {
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
    }
});
