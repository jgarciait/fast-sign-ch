"use client"

import { useState, useEffect } from 'react'
import { pdfjs } from 'react-pdf'

interface WorkerTestResult {
  url: string
  status: 'success' | 'failed' | 'testing'
  error?: string
  contentType?: string
}

export default function PDFWorkerDebug({ show = true }: { show?: boolean }) {
  const [results, setResults] = useState<WorkerTestResult[]>([])
  const [currentWorker, setCurrentWorker] = useState<string>('')

  const workerPaths = [
    '/pdf.worker.min.mjs',
    '/pdf.worker.mjs',
    '/api/worker/pdf.worker.min.mjs',
    '/api/worker/pdf.worker.mjs',
    'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs'
  ]

  const testWorker = async (path: string): Promise<WorkerTestResult> => {
    // Force correct port detection - get current port from window.location
    let currentOrigin = 'http://localhost:3001' // Default fallback
    
    if (typeof window !== 'undefined') {
      const currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
      const currentHost = window.location.hostname
      const currentProtocol = window.location.protocol
      currentOrigin = `${currentProtocol}//${currentHost}:${currentPort}`
      
      // Additional debug
      console.log('Port detection:', {
        protocol: currentProtocol,
        hostname: currentHost,
        port: currentPort,
        origin: window.location.origin,
        constructed: currentOrigin
      })
    }
    
    const fullUrl = path.startsWith('http') ? path : `${currentOrigin}${path}`
    console.log('Testing worker path:', fullUrl) // Debug log
    
    try {
      const response = await fetch(fullUrl, { method: 'HEAD' })
      const contentType = response.headers.get('content-type') || 'unknown'
      
      if (response.ok) {
        return {
          url: fullUrl,
          status: 'success',
          contentType
        }
      } else {
        return {
          url: fullUrl,
          status: 'failed',
          error: `HTTP ${response.status}: ${response.statusText}`,
          contentType
        }
      }
    } catch (error) {
      return {
        url: fullUrl,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  const runTests = async () => {
    setResults([])
    
    for (const path of workerPaths) {
      const fullUrl = path.startsWith('http') ? path : `${window.location.origin}${path}`
      setResults(prev => [...prev, { url: fullUrl, status: 'testing' }])
      
      const result = await testWorker(path)
      setResults(prev => prev.map(r => r.url === fullUrl ? result : r))
    }
  }

  useEffect(() => {
    setCurrentWorker(pdfjs.GlobalWorkerOptions.workerSrc || 'Not configured')
  }, [])

  useEffect(() => {
    // Delay test to ensure window.location is properly set
    const timeoutId = setTimeout(() => {
      runTests()
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [])

  if (!show) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg p-4 max-w-md shadow-lg z-50">
      <div className="mb-4">
        <h3 className="font-bold text-sm mb-2">PDF Worker Debug</h3>
        <div className="text-xs">
          <strong>Current Worker:</strong> 
          <div className="break-all text-blue-600">{currentWorker}</div>
        </div>
        <div className="text-xs mt-2">
          <strong>Environment:</strong> {process.env.NODE_ENV} | {typeof window !== 'undefined' ? window.location.hostname : 'unknown'}
        </div>
        <div className="text-xs mt-1">
          <strong>Current Origin:</strong> {typeof window !== 'undefined' ? window.location.origin : 'unknown'}
        </div>
        <div className="text-xs mt-1">
          <strong>Detected Port:</strong> {typeof window !== 'undefined' ? window.location.port : 'unknown'}
        </div>
        <div className="text-xs mt-1">
          <strong>Full URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'unknown'}
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium">Worker Tests:</span>
          <button 
            onClick={runTests}
            className="text-xs bg-blue-500 text-white px-2 py-1 rounded"
          >
            Retry
          </button>
        </div>
        
        {results.map((result, index) => (
          <div key={index} className="text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                result.status === 'success' ? 'bg-green-500' :
                result.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
              }`} />
              <span className="break-all">{result.url}</span>
            </div>
            {result.contentType && (
              <div className="ml-4 text-gray-600">
                Content-Type: {result.contentType}
              </div>
            )}
            {result.error && (
              <div className="ml-4 text-red-600">
                Error: {result.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
