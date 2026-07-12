import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['pwa-icon.svg'],
        manifest: {
          name: 'Consultio Med',
          short_name: 'Consultio',
          description: 'Gestão Inteligente de Clínicas e Consultórios',
          theme_color: '#0d9488',
          background_color: '#f8fafc',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          categories: ['business', 'medical', 'productivity'],
          icons: [
            {
              src: 'pwa-icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            },
            {
              src: 'pwa-icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-icon-512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ],
          shortcuts: [
            {
              name: 'Mensagens',
              short_name: 'Mensagens',
              description: 'Abrir conversas da clinica',
              url: '/?view=Mensagens',
              icons: [{ src: 'pwa-icon-192.png', sizes: '192x192', type: 'image/png' }]
            },
            {
              name: 'Agenda',
              short_name: 'Agenda',
              description: 'Abrir agenda da clinica',
              url: '/?view=Agenda',
              icons: [{ src: 'pwa-icon-192.png', sizes: '192x192', type: 'image/png' }]
            },
            {
              name: 'Painel SaaS',
              short_name: 'SaaS',
              description: 'Abrir painel de plataforma',
              url: '/?view=Painel%20SaaS',
              icons: [{ src: 'pwa-icon-192.png', sizes: '192x192', type: 'image/png' }]
            }
          ]
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
          runtimeCaching: [
            {
              urlPattern: /^https?:\/\/.*\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24
                }
              }
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks - external dependencies
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': ['lucide-react', 'motion', 'zod'],
            
            // Feature chunks - lazy loaded on demand, reduces initial bundle
            'feature-crm': ['./src/components/CrmModule.tsx'],
            'feature-finance': ['./src/components/Financeiro.tsx'],
            'feature-medical': ['./src/components/MedicalRecords.tsx'],
            'feature-agents': ['./src/components/AgentModules.tsx'],
            'feature-automation': ['./src/components/AutomationModule.tsx'],
            'feature-chat': ['./src/components/ChatAssistant.tsx'],
            
            // Core app components
            'app-core': ['./src/App.tsx', './src/components/Sidebar.tsx', './src/components/Header.tsx'],
          },
        },
      },
      chunkSizeWarningLimit: 500,
      sourcemap: process.env.NODE_ENV === 'production' ? false : true,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
