import bundleAnalyzer from '@next/bundle-analyzer'
import path from 'path'
import { fileURLToPath } from 'url'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: ['pdfjs-dist'],
  images: {
    unoptimized: true,
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    domains: ['localhost', 'oimwujowegcnddrehsxo.supabase.co', 'dxigfnzbmqlearlonhoc.supabase.co'],
  },
  experimental: {
    // optimizeCss: true, // Desactivado temporalmente - causa error 'critters' 
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-menubar',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-sheet',
      '@radix-ui/react-sidebar',
      '@radix-ui/react-slot',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
      'date-fns'
    ],
    serverActions: {
      bodySizeLimit: '200mb', // Increased for large PDF operations
      allowedOrigins: ['localhost:3001', 'localhost:3000'], // Allow both ports
    },
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // output: 'standalone', // Comentado para evitar errores EPERM en Windows

  async headers() {
    return [
      {
        // Apply headers to PDF worker files - .mjs first (highest priority)
        source: '/pdf.worker.mjs',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Priority',
            value: 'high',
          },
        ],
      },
      {
        source: '/pdf.worker.min.mjs',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Priority',
            value: 'high',
          },
        ],
      },
      // PDF Worker files - can be cached long term
      {
        source: '/pdf.worker.mjs',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/pdf.worker.min.mjs',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Main app pages - prevent aggressive mobile caching
      {
        source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          // Safari-specific headers
          {
            key: 'X-Accel-Expires',
            value: '0',
          },
        ],
      },
      // API routes - never cache
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },

  async rewrites() {
    return [
      // No PDF worker redirects - let files be served directly
    ]
  },

  webpack: (config, { isServer, buildId, dev, webpack }) => {
    // Handle PDF.js worker files
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      }
    }

    // Improve Server Action handling and reduce compilation issues
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.mjs': ['.mjs', '.mts'],
    }

    // Optimize cache strategy to reduce large string serialization warnings
    config.cache = {
      ...config.cache,
      type: 'filesystem',
      cacheDirectory: path.resolve(process.cwd(), '.next/cache/webpack'),
      maxMemoryGenerations: dev ? 5 : 1,
      compression: 'gzip',
      buildDependencies: {
        config: [fileURLToPath(import.meta.url)],
      },
      // Optimize large string handling
      maxAge: 5184000000, // 60 days
      store: 'pack',
      version: buildId,
      // Configure pack strategy to handle large strings better
      allowCollectingMemory: true,
      memoryCacheUnaffected: true,
    }

    // CRÍTICO: Excluir librerías PDF del servidor para evitar "self is not defined"
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push(
        '@react-pdf-viewer/core',
        '@react-pdf-viewer/default-layout',
        'canvas'
      )
      
      // Handle ES Module imports properly for pdfjs-dist 4.8.69
      config.resolve = config.resolve || {}
      config.resolve.extensionAlias = {
        ...config.resolve.extensionAlias,
        '.js': ['.js', '.ts', '.tsx', '.mjs'],
        '.mjs': ['.mjs', '.js']
      }
    }

    // Handle ES modules for both server and client
    config.module = config.module || {}
    config.module.rules = config.module.rules || []

    // Handle pdfjs-dist ES modules for version 4.8.69
    config.module.rules.push({
      test: /node_modules\/pdfjs-dist\/.*\.mjs$/,
      type: 'javascript/auto',
      resolve: {
        fullySpecified: false,
      },
    })

    // Handle general ES modules
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
      resolve: {
        fullySpecified: false,
      },
    })

    config.module.rules.push({
      test: /pdf\.worker\.(min\.)?js/,
      type: 'asset/resource',
      generator: {
        filename: 'static/worker/[hash][ext][query]',
      },
      parser: {
        dataUrlCondition: {
          maxSize: 8 * 1024, // 8kb - use data URL for small files
        },
      },
    })

    config.module.rules.push({
      test: /pdf\.worker\.mjs/,
      type: 'asset/resource',
      generator: {
        filename: 'static/worker/[hash][ext][query]',
      },
      parser: {
        dataUrlCondition: {
          maxSize: 8 * 1024, // 8kb - use data URL for small files
        },
      },
    })

    config.module.rules.push({
      test: /\.worker\.js$/,
      type: 'asset/resource',
      parser: {
        dataUrlCondition: {
          maxSize: 8 * 1024, // 8kb - use data URL for small files
        },
      },
    })
    
    // CORREGIDO: Optimización de webpack solo para cliente
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          maxSize: 244000, // 244kb chunks máximo
          // Reduce large string serialization impact
          minSize: 20000,
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
          cacheGroups: {
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: -10,
              chunks: 'all',
              enforce: true,
            },
            // Separar librerías pesadas SOLO EN CLIENTE
            pdf: {
              test: /[\\/]node_modules[\\/](react-pdf|pdfjs-dist)[\\/]/,
              name: 'pdf-libs',
              priority: 10,
              chunks: 'all',
              enforce: true,
            },
            ui: {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              name: 'ui-libs',
              priority: 5,
              chunks: 'all',
              enforce: true,
            },
          },
        },
        // Minimize impact of large strings on performance
        usedExports: true,
        sideEffects: false,
      }
    }
    
    return config
  },
}

export default withBundleAnalyzer(nextConfig)
