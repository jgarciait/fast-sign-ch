import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import { GlobalPDFDocumentProvider } from "@/components/global-pdf-document-provider"
import "@/utils/polyfills"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "AQSign - Document Signing",
  description: "Secure document signing platform",
  generator: 'v0.dev',
  other: {
    'cache-control': 'no-cache, no-store, must-revalidate',
    'pragma': 'no-cache',
    'expires': '0',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        <link rel="icon" href="/placeholder-logo.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
        
        {/* Preload PDF.js worker for faster document loading */}
        <link 
          rel="modulepreload" 
          href="/pdf.worker.mjs" 
          as="script"
          crossOrigin="anonymous"
        />
        
        {/* CRITICAL: Configure PDF.js worker IMMEDIATELY - before any components load */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Global PDF.js worker configuration - runs before any React components
              if (typeof window !== 'undefined') {
                // Set worker path immediately - this will be used by PDF.js components
                window.__PDFJS_WORKER_SRC = '/pdf.worker.mjs';
                window.__PDFJS_WORKER_CONFIGURED = true;
                

                
                // Also try to configure PDF.js immediately if it's already loaded
                if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
                  window.pdfjsLib.GlobalWorkerOptions.workerSrc = window.__PDFJS_WORKER_SRC;

                }
              }
            `,
          }}
        />
        
        {/* Prefetch PDF.js worker to ensure it's cached */}
        <link 
          rel="prefetch" 
          href="/pdf.worker.mjs" 
          as="script"
        />
      </head>
      <body className={inter.className}>
        <GlobalPDFDocumentProvider>
          {children}
          <Toaster />
        </GlobalPDFDocumentProvider>
      </body>
    </html>
  )
}
