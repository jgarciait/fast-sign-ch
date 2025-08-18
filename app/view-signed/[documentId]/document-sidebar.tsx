"use client"

import Link from "next/link"
import { ArrowLeft, ChevronDown, ChevronRight, Clock, FileText, Send, CheckCircle, User, Calendar, Upload } from "lucide-react"
import { useState } from "react"
import SendToAquariusModal from "@/components/send-to-aquarius-modal"

interface DocumentSidebarProps {
  document: any
  request: any
  recipientEmail: string
  signatures: any[]
  annotations: any[]
  requestId: string
  documentUrl: string
}

export default function DocumentSidebar({
  document,
  request,
  recipientEmail,
  signatures,
  annotations,
  requestId,
  documentUrl,
}: DocumentSidebarProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [showAquariusModal, setShowAquariusModal] = useState(false)



  const handlePrint = async () => {
    console.log('🖨️ Print button clicked!')
    setIsPrinting(true)
    
    try {
      // Get URL parameters from current window for the print endpoint
      const urlParams = new URLSearchParams(window.location.search)
      const token = urlParams.get('token')
      
      console.log('Print Debug - Current URL params:', {
        currentUrl: window.location.href,
        token: token ? 'found' : 'missing',
        requestId: requestId ? 'found' : 'missing',
        documentId: document.id
      })
      
      if (!token) {
        console.error('❌ No token found!')
        alert('Authentication token not found. Please refresh the page and try again.')
        return
      }

      // Step 1: First, fetch the merged PDF with signatures
      const mergedPdfUrl = `/api/documents/${document.id}/print?token=${encodeURIComponent(token)}&requestId=${encodeURIComponent(requestId)}`
      
      console.log('🔗 Fetching merged PDF with signatures:', mergedPdfUrl)
      
      // Fetch the merged PDF first to ensure it's processed
      const response = await fetch(mergedPdfUrl)
      
      if (!response.ok) {
        console.error('❌ Failed to generate merged PDF:', response.status, response.statusText)
        alert(`Failed to generate signed document: ${response.statusText}`)
        return
      }
      
      console.log('✅ Merged PDF generated successfully')
      
      // Step 2: Create a blob URL for the merged PDF
      const pdfBlob = await response.blob()
      const blobUrl = URL.createObjectURL(pdfBlob)
      
      console.log('📄 Created blob URL for merged PDF')
      
      // Step 3: Create a temporary download link and click it to open in new tab
      const downloadLink = window.document.createElement('a')
      downloadLink.href = blobUrl
      downloadLink.target = '_blank'
      downloadLink.download = `SIGNED_${document.file_name}`
      
      // Add to DOM temporarily
      window.document.body.appendChild(downloadLink)
      
      // Click the link to open in new tab
      downloadLink.click()
      
      // Remove from DOM
      window.document.body.removeChild(downloadLink)
      
      console.log('🌐 Opened merged PDF in new tab using download link')
      
      // Clean up blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
        console.log('🧹 Cleaned up blob URL')
      }, 10000) // Longer delay to ensure PDF is fully loaded
      
    } catch (error) {
      console.error('❌ Error processing signed document for printing:', error)
      alert('Failed to process the signed document. Please try again.')
    } finally {
      setIsPrinting(false)
    }
  }

  // Create timeline events
  const timelineEvents = [
    {
      id: 1,
      title: "Document Created",
      description: `${document.file_name} was uploaded`,
      timestamp: document.created_at,
      icon: FileText,
      type: "created"
    },
    {
      id: 2,
      title: "Sent for Signature",
      description: `Sent to ${request.customer_first_name} ${request.customer_last_name}`,
      timestamp: request.created_at,
      icon: Send,
      type: "sent"
    },
    ...(request.signed_at ? [{
      id: 3,
      title: "Document Signed",
      description: `Signed by ${request.customer_first_name} ${request.customer_last_name}`,
      timestamp: request.signed_at,
      icon: CheckCircle,
      type: "signed"
    }] : [])
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  return (
    <div 
      className="w-80 border-l border-border flex flex-col shadow-lg" 
      style={{ 
        backgroundColor: '#FFFFFF'
      }}
    >
      {/* Sidebar header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-end mb-3">
          <span className="text-xs text-muted-foreground">
            Last updated: {new Date(request.signed_at || document.created_at).toLocaleDateString()}
          </span>
        </div>
        
        <h1 className="text-lg font-semibold text-foreground truncate mb-2" title={document.file_name}>
          {document.file_name}
        </h1>
        <div className="flex items-center justify-between mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success text-success-foreground">
            ✓ Signed Document
          </span>
          <span className="text-xs text-muted-foreground">
            {signatures?.length || 0} signature{(signatures?.length || 0) !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Print Button */}
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="w-full inline-flex items-center justify-center px-4 py-3 shadow-sm text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#0d2340',
            }}
          >
            {isPrinting ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Merging Signatures...
              </>
            ) : (
              <>
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Signed Document
              </>
            )}
          </button>

          {/* Send to Aquarius Button */}
          <button
            onClick={() => setShowAquariusModal(true)}
            className="w-full inline-flex items-center justify-center px-4 py-3 shadow-sm text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <Upload className="h-4 w-4 mr-2" />
            Send to Aquarius
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Document Timeline */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center">
            <Clock className="w-4 h-4 mr-2 text-blue-400" />
            Document Timeline
          </h3>
          
          <div className="space-y-4">
            {timelineEvents.map((event, index) => {
              const Icon = event.icon
              const isLast = index === timelineEvents.length - 1
              
              return (
                <div key={event.id} className="relative">
                  {/* Timeline line */}
                  {!isLast && (
                    <div className="absolute left-4 top-8 bottom-0 w-px bg-border"></div>
                  )}
                  
                  {/* Timeline item */}
                  <div className="flex items-start space-x-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      event.type === 'created' ? 'bg-primary text-primary-foreground' :
                      event.type === 'sent' ? 'bg-warning text-warning-foreground' :
                      event.type === 'signed' ? 'bg-success text-success-foreground' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {event.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {event.description}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(event.timestamp).toLocaleDateString()} at {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Request Information */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center">
            <User className="w-4 h-4 mr-2 text-blue-400" />
            Request Information
          </h3>
          
          <div className="bg-background rounded-lg p-3 border border-border space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Request ID:</span>
              <span className="font-mono text-xs text-foreground">{requestId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status:</span>
              <span className={`font-medium capitalize ${
                request.status === 'signed' ? 'text-success' :
                request.status === 'sent' ? 'text-warning' :
                'text-muted-foreground'
              }`}>
                {request.status}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Recipient:</span>
              <span className="font-medium text-foreground">{request.customer_first_name} {request.customer_last_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium text-foreground truncate ml-2" title={recipientEmail}>
                {recipientEmail}
              </span>
            </div>
            {request.message && (
              <div className="pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">Message:</span>
                <p className="text-sm text-foreground mt-1">{request.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Details Section */}
        <div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors"
          >
            <span className="flex items-center">
              <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
              Detailed Information
            </span>
            {showDetails ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          
          {showDetails && (
            <div className="mt-4 space-y-4">
              {/* Document details */}
              <div className="bg-background rounded-lg p-3 border border-border">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Document Details</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">File size:</span>
                    <span className="font-medium text-foreground">{Math.round(document.file_size / 1024)} KB</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium text-foreground">{document.file_type}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium text-foreground">{new Date(document.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Signature details */}
              {signatures && signatures.length > 0 && (
                <div className="bg-background rounded-lg p-3 border border-border">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Signatures</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total signatures:</span>
                      <span className="font-medium text-foreground">
                        {(() => {
                          const totalSignatures = signatures.reduce((total: number, sigRecord: any) => {
                            if (sigRecord.signature_data?.signatures) {
                              return total + sigRecord.signature_data.signatures.length
                            } else if (sigRecord.signature_data?.dataUrl) {
                              return total + 1
                            }
                            return total
                          }, 0)
                          return totalSignatures
                        })()}
                      </span>
                    </div>
                    {signatures.map((sig: any, index: number) => (
                      <div key={sig.id} className="bg-muted rounded-lg p-3 text-sm border border-border">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-foreground">Signature {index + 1}</span>
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                            {sig.signature_source || 'canvas'}
                          </span>
                        </div>
                        {sig.signed_at && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(sig.signed_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Content summary */}
              <div className="bg-background rounded-lg p-3 border border-border">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Content Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total annotations:</span>
                    <span className="font-medium text-foreground">{annotations.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Signatures:</span>
                    <span className="font-medium text-foreground">{annotations.filter((a: any) => a.type === 'signature').length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Text annotations:</span>
                    <span className="font-medium text-foreground">{annotations.filter((a: any) => a.type !== 'signature').length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Send to Aquarius Modal */}
      <SendToAquariusModal
        isOpen={showAquariusModal}
        onClose={() => setShowAquariusModal(false)}
        documentId={document.id}
        documentName={document.file_name}
        token={typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('token') || '') : ''}
        requestId={requestId}
        onSuccess={() => {
          setShowAquariusModal(false)
          // Could add a success toast here
        }}
      />
    </div>
  )
}
