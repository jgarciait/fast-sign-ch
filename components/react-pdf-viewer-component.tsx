"use client"

import { useState } from 'react'
import { Worker, Viewer } from '@react-pdf-viewer/core'
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout'

// Import CSS
import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/default-layout/lib/styles/index.css'

interface ReactPdfViewerComponentProps {
  documentUrl: string
  documentName: string
  onSign?: () => void
  onBack?: () => void
  showSignButton?: boolean
  showBackButton?: boolean
  height?: string
}

export default function ReactPdfViewerComponent({
  documentUrl,
  documentName,
  onSign,
  onBack,
  showSignButton = false,
  showBackButton = false,
  height = '100vh'
}: ReactPdfViewerComponentProps) {
  const [isLoading, setIsLoading] = useState(true)

  // Create default layout plugin
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: (defaultTabs) => [
      // Keep only the bookmark and thumbnail tabs
      defaultTabs[0], // Thumbnails
      defaultTabs[1], // Bookmarks
    ],
  })

  const handleDocumentLoad = () => {
    setIsLoading(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Custom header with back button and sign button */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-4">
          {showBackButton && (
            <button
              onClick={onBack}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          )}
          <h1 className="text-lg font-semibold text-gray-900 truncate max-w-md">
            {documentName}
          </h1>
        </div>
        
        {showSignButton && (
          <button
            onClick={onSign}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Sign Document
          </button>
        )}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading PDF...</span>
        </div>
      )}

      {/* PDF Viewer */}
      <div className="flex-1 overflow-hidden">
        <Worker workerUrl="/pdf.worker.min.mjs">
          <div style={{ height }}>
            <Viewer
              fileUrl={documentUrl}
              plugins={[defaultLayoutPluginInstance]}
              onDocumentLoad={handleDocumentLoad}
              theme={{
                theme: 'light',
              }}
            />
          </div>
        </Worker>
      </div>
    </div>
  )
}
