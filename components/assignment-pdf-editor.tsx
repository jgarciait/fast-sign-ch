"use client"

import "@/utils/polyfills"
import type React from "react"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { ChevronLeft, Save, Pen, Type, Trash2, Check, Send, X, Plus, Minus, RotateCcw, Edit3, ChevronRight, Hand, Menu, Settings } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import SignatureSelectionModal from "./signature-selection-modal"
import SimpleSignatureCanvas from "./simple-signature-canvas"
import { Logo } from "./logo"
import { useToast } from "@/hooks/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import dynamic from 'next/dynamic'
import { getUnifiedPageDimensions, convertRelativeToAbsolute, convertAbsoluteToRelative } from "@/utils/pdf-dimensions"
import { forceCorrectDimensions, correctPageInfo, needsDimensionCorrection } from "@/utils/force-correct-pdf-dimensions"
import { logSignatureCoordinateDebug } from "@/utils/debug-signature-coordinates"


// Simple dynamic imports - let Next.js handle the chunking
const Document = dynamic(() => import('react-pdf').then(mod => mod.Document), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )
})

// Use enhanced PDF page component with direct PDF.js dimension detection
const EnhancedPdfPageWithOverlay = dynamic(() => import('./enhanced-pdf-page-with-overlay'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <div className="text-gray-600">🔍 Detectando dimensiones correctas del PDF...</div>
      </div>
    </div>
  )
})

// Import centralized PDF configuration
import PDF_CONFIG, { configurePdfWorker } from '@/utils/pdf-config-centralized'

// Use centralized PDF options
const PDF_OPTIONS = PDF_CONFIG

// Configure PDF.js worker on import
configurePdfWorker()

// Early PDF.js worker configuration fallback
if (typeof window !== 'undefined') {
  // Additional fallback - ensure worker is configured
  import('react-pdf').then(({ pdfjs }) => {
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      configurePdfWorker()
    }
  }).catch(() => {
    // Ignore if react-pdf is not available yet
  })
}

export type Annotation = {
  id: string
  type: "signature" | "text"
  x: number
  y: number
  width: number
  height: number
  content?: string
  imageData?: string
  signatureSource?: 'canvas' | 'wacom'
  page: number
  relativeX?: number
  relativeY?: number
  timestamp: string
  relativeWidth?: number
  relativeHeight?: number
  fontSize?: number // Font size for text annotations (8-19px)
  readOnly?: boolean // Individual annotation read-only flag
  isExistingSignature?: boolean // Flag to identify existing signatures from fast-sign
  sourcePageDimensions?: { // CRITICAL: Store true PDF dimensions for accurate saving
    width: number
    height: number
    orientation: 'PORTRAIT' | 'LANDSCAPE'
    aspectRatio: number
  }
}

interface PdfAnnotationEditorProps {
  documentUrl: string
  documentName: string
  documentId: string
  onBack: () => void
  onSave: (annotations: Annotation[]) => Promise<void>
  onSend?: (annotations: Annotation[]) => Promise<void>
  onContinue?: () => void // New prop for continuing after mapping save
  initialAnnotations?: Annotation[]
  token?: string
  readOnly?: boolean
  hideSaveButton?: boolean
  onOpenSidebar?: () => void
  onOpenRightSidebar?: () => void
  mappingMode?: boolean
  internalMappingMode?: boolean
  previewMode?: boolean
  onPdfReady?: () => void
  onPageDimensionsReady?: () => void
  showMappingToggle?: boolean
}

// Document Boundaries Component
// DocumentBoundaries component REMOVED - visual boundaries were inaccurate and confusing
// ALL boundary checking has been eliminated - users can place elements anywhere

export default function AssignmentPdfEditor({
  documentUrl,
  documentName,
  documentId,
  onBack,
  onSave,
  onSend,
  onContinue,
  initialAnnotations = [],
  token,
  readOnly = false,
  hideSaveButton = false,
  onOpenSidebar,
  onOpenRightSidebar,
  mappingMode = false,
  previewMode = false,
  onPdfReady,
  onPageDimensionsReady,
  showMappingToggle = false,
}: PdfAnnotationEditorProps) {

  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations)
  const annotationsRef = useRef<Annotation[]>(initialAnnotations) // Keep current annotations always available

  // Keep ref in sync with state
  useEffect(() => {
    annotationsRef.current = annotations
  }, [annotations])

  const [currentTool, setCurrentTool] = useState<"select" | "signature" | "text">("select")


  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [showSimpleCanvas, setShowSimpleCanvas] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [showContinueButton, setShowContinueButton] = useState(false)
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [pendingSignature, setPendingSignature] = useState<{ dataUrl: string; source: 'canvas' | 'wacom'; timestamp: string } | null>(null)
  const [pdfLoadError, setPdfLoadError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [persistentSignatureMode, setPersistentSignatureMode] = useState(true)
  const [showPulseAnimation, setShowPulseAnimation] = useState(false)
  const [isPlacingSignature, setIsPlacingSignature] = useState(false)
  const [isDraggingAnnotation, setIsDraggingAnnotation] = useState(false)

  // Document boundaries state - REMOVED: visual boundaries were inaccurate
  const [draggingSignatureId, setDraggingSignatureId] = useState<string | null>(null)

  // Signature mapping mode state - initialize from prop
  const [internalMappingMode, setInternalMappingMode] = useState(mappingMode || false)

  // Signature highlight pulse state
  const [highlightedSignature, setHighlightedSignature] = useState<{
    id: string
    page: number
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  // Failsafe to reset dragging state
  useEffect(() => {
    if (isDraggingAnnotation) {
      const timeout = setTimeout(() => {

        setIsDraggingAnnotation(false)
        // Document boundaries removed
        setDraggingSignatureId(null)
      }, 3000) // Reset after 3 seconds if stuck

      return () => clearTimeout(timeout)
    }
  }, [isDraggingAnnotation])

  // CRITICAL: Handle force sync requests from parent component
  useEffect(() => {
    const handleSyncRequest = (event: CustomEvent) => {


        // Store current annotations in a global variable for parent to access
        ; (window as any).lastSyncedAnnotations = [...annotations]


    }

    window.addEventListener('requestCurrentAnnotations', handleSyncRequest as EventListener)
    return () => window.removeEventListener('requestCurrentAnnotations', handleSyncRequest as EventListener)
  }, [annotations])

  // Mobile detection
  const isMobile = useIsMobile()

  const [originalSignatures, setOriginalSignatures] = useState<Annotation[]>([]) // Track original signatures from DB
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const documentRef = useRef<HTMLDivElement>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const { toast } = useToast()

  const [pagesDimensions, setPagesDimensions] = useState<Map<number, any>>(new Map())

  // SCALING STATE - Add zoom/scale functionality 
  const [scale, setScale] = useState<number>(1.0)
  const [maxScale, setMaxScale] = useState<number>(1.75)

  // Calculate dynamic zoom limits based on container and page dimensions
  const calculateMaxScale = useCallback(() => {
    if (!containerRef.current || pagesDimensions.size === 0) return 1.75

    const containerWidth = containerRef.current.clientWidth
    const currentPageDimensions = pagesDimensions.get(currentPage)

    if (!currentPageDimensions || !containerWidth) return 1.75

    // Calculate maximum scale that fits within container width (with some padding)
    const maxScaleForWidth = (containerWidth * 0.95) / currentPageDimensions.originalWidth

    // Ensure minimum is 1.0 and maximum is 175%
    return Math.max(1.0, Math.min(maxScaleForWidth, 1.75))
  }, [currentPage, pagesDimensions, containerRef])

  // Update max scale when page or container changes
  useEffect(() => {
    const newMaxScale = calculateMaxScale()
    setMaxScale(newMaxScale)

    // If current scale exceeds new max, reduce it
    if (scale > newMaxScale) {
      setScale(newMaxScale)
    }
  }, [currentPage, pagesDimensions.size, calculateMaxScale, scale])



  // Listen for window resize to recalculate max scale
  useEffect(() => {
    const handleResize = () => {
      const newMaxScale = calculateMaxScale()
      setMaxScale(newMaxScale)

      // If current scale exceeds new max, reduce it
      if (scale > newMaxScale) {
        setScale(newMaxScale)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [calculateMaxScale, scale])

  // ZOOM CONTROLS - Dynamic scaling functions
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, maxScale))
  }

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 1.0)) // Min 100%
  }

  const handleFitWidth = () => {
    setScale(1.0) // Reset to 100%
  }

  // Trigger pulse animation when persistent mode is activated
  useEffect(() => {
    if (persistentSignatureMode && pendingSignature) {
      setShowPulseAnimation(true)
      const timer = setTimeout(() => {
        setShowPulseAnimation(false)
      }, 2000) // Animation lasts 2 seconds
      return () => clearTimeout(timer)
    }
  }, [persistentSignatureMode, pendingSignature])

  // Listen for signature highlight events from accordion
  useEffect(() => {
    const handleHighlightSignature = (event: CustomEvent) => {
      const { signatureId, page, x, y, width, height } = event.detail
      console.log('📍 Highlighting signature:', { signatureId, page, x, y, width, height })
      
      // Set current page if different
      if (page !== currentPage) {
        setCurrentPage(page)
      }
      
      // Set highlighted signature for pulse effect
      setHighlightedSignature({ id: signatureId, page, x, y, width, height })
      
      // Remove highlight after pulse animation (2 seconds)
      setTimeout(() => {
        setHighlightedSignature(null)
      }, 2000)
    }

    window.addEventListener('highlightSignature', handleHighlightSignature as EventListener)
    return () => window.removeEventListener('highlightSignature', handleHighlightSignature as EventListener)
  }, [currentPage])

  // Touch/swipe handling for page navigation
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null)



  // Minimum swipe distance (in px)
  const minSwipeDistance = 50
  
  // Prevent repeated auto-navigation to first signature page
  const hasAutoNavigatedToFirstSignaturePageRef = useRef(false)

  // 🎯 HELPER: Get display width for rotated pages
  const getDisplayWidth = (pageDimensions: any, fallbackWidth: number) => {
    if (!pageDimensions) return fallbackWidth
    // For 90° and 270° rotations, width and height are swapped
    if (pageDimensions.actualRotation === 90 || pageDimensions.actualRotation === 270) {
      return pageDimensions.originalHeight || fallbackWidth
    }
    return pageDimensions.originalWidth || fallbackWidth
  }

  // 🎯 HELPER: Get display height for rotated pages  
  const getDisplayHeight = (pageDimensions: any, fallbackHeight: number) => {
    if (!pageDimensions) return fallbackHeight
    // For 90° and 270° rotations, width and height are swapped
    if (pageDimensions.actualRotation === 90 || pageDimensions.actualRotation === 270) {
      return pageDimensions.originalWidth || fallbackHeight
    }
    return pageDimensions.originalHeight || fallbackHeight
  }

  // SIMPLE COORDINATE SYSTEM: Convert relative coordinates to absolute screen coordinates
  const convertAnnotationsRelativeToAbsolute = (annotations: Annotation[]): Annotation[] => {
    if (!annotations || !Array.isArray(annotations)) {
      console.warn('convertRelativeToAbsolute: annotations is not a valid array')
      return []
    }
    return annotations.map(annotation => {
      // Use relative coordinates to calculate absolute screen coordinates
      if (annotation.relativeX !== undefined && annotation.relativeY !== undefined &&
        annotation.relativeWidth !== undefined && annotation.relativeHeight !== undefined) {
        // Get the page dimensions for this annotation's page
        const pageDimensions = pagesDimensions.get(annotation.page)
        if (!pageDimensions) {
          console.warn('No page dimensions for page:', annotation.page, 'cannot display annotation')
          return annotation
        }

        // 🎯 CRITICAL FIX: Use display dimensions for rotated pages (overlay display)
        const displayWidth = getDisplayWidth(pageDimensions, 612)
        const displayHeight = getDisplayHeight(pageDimensions, 792)

        const absoluteX = annotation.relativeX * displayWidth
        const absoluteY = annotation.relativeY * displayHeight
        const absoluteWidth = annotation.relativeWidth * displayWidth
        const absoluteHeight = annotation.relativeHeight * displayHeight

        console.log('🎯 ANNOTATION LOAD (Fixed Display Dimensions):', {
          id: annotation.id,
          page: annotation.page,
          rotation: pageDimensions.actualRotation,
          relativeCoords: { x: annotation.relativeX, y: annotation.relativeY, width: annotation.relativeWidth, height: annotation.relativeHeight },
          screenCoordinates: { x: absoluteX, y: absoluteY, width: absoluteWidth, height: absoluteHeight },
          displayDimensions: { width: displayWidth, height: displayHeight },
          note: 'Using correct display dimensions for rotated pages'
        })

        return {
          ...annotation,
          x: absoluteX,
          y: absoluteY,
          width: absoluteWidth,
          height: absoluteHeight
        }
      } else {
        // Missing relative coordinates
        console.error('Annotation missing relative coordinates:', annotation.id)
        return annotation
      }
    })
  }

  // SIMPLE COORDINATE SYSTEM: Convert absolute to relative using screen coordinates
  const convertAnnotationAbsoluteToRelative = (annotation: Annotation): Annotation => {
    const pageDimensions = pagesDimensions.get(annotation.page)
    if (!pageDimensions) {
      console.warn('No page dimensions for page:', annotation.page, 'cannot convert to relative coordinates')
      return annotation
    }

    // 🎯 CRITICAL FIX: Use display dimensions for rotated pages (absolute to relative)
    const displayWidth = getDisplayWidth(pageDimensions, 612)
    const displayHeight = getDisplayHeight(pageDimensions, 792)

    const relativeX = annotation.x / displayWidth
    const relativeY = annotation.y / displayHeight
    const relativeWidth = annotation.width / displayWidth
    const relativeHeight = annotation.height / displayHeight

    console.log('🎯 CONVERT TO RELATIVE (Fixed Display Dimensions):', {
      id: annotation.id,
      type: annotation.type,
      page: annotation.page,
      rotation: pageDimensions.actualRotation,
      screenAbsolute: { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height },
      displayDimensions: { width: displayWidth, height: displayHeight },
      calculatedRelative: { x: relativeX, y: relativeY, width: relativeWidth, height: relativeHeight },
      note: 'Using correct display dimensions for rotated pages'
    })

    return {
      ...annotation,
      relativeX,
      relativeY,
      relativeWidth,
      relativeHeight
    }
  }



  // Store page dimensions when pages load - FORCE CORRECT DIMENSIONS
  const handlePageLoad = (pageNumber: number, pageInfo: any) => {


    // APPLY BRUTAL DIMENSION CORRECTION using utility
    const correctedPageInfo = correctPageInfo(pageInfo)
    
    if (correctedPageInfo.correctionApplied) {
      console.warn(`🚨 EDITOR: APPLIED EMERGENCY DIMENSION CORRECTION for page ${pageNumber}:`, {
        original: correctedPageInfo.originalDimensions,
        corrected: { width: correctedPageInfo.originalWidth, height: correctedPageInfo.originalHeight },
        note: 'FORCED to fix React PDF dimension inversion bug'
      })
    }

    // Use unified dimension system with CORRECTED dimensions
    const dimensions = getUnifiedPageDimensions(correctedPageInfo, 1.0)
    
    // 🚨 ADD DISPLAY DIMENSIONS if available from PDF-lib enhanced components
    if (correctedPageInfo.pdfLibProperties) {
      (dimensions as any).displayWidth = correctedPageInfo.pdfLibProperties.width
      ;(dimensions as any).displayHeight = correctedPageInfo.pdfLibProperties.height
      ;(dimensions as any).originalPdfWidth = correctedPageInfo.pdfLibProperties.originalWidth
      ;(dimensions as any).originalPdfHeight = correctedPageInfo.pdfLibProperties.originalHeight
      ;(dimensions as any).actualRotation = correctedPageInfo.pdfLibProperties.actualRotate
      
      console.log('📐 ENHANCED: Added display dimensions from PDF-lib:', {
        pageNumber,
        originalDimensions: { width: dimensions.originalWidth, height: dimensions.originalHeight },
        displayDimensions: { width: (dimensions as any).displayWidth, height: (dimensions as any).displayHeight },
        actualRotation: (dimensions as any).actualRotation
      })
    }



    setPagesDimensions(prev => {
      const newMap = new Map(prev.set(pageNumber, dimensions))

      // Check if we have dimensions for the first page and call callback
      if (pageNumber === 1 && dimensions && onPageDimensionsReady) {
        // Small delay to ensure dimensions are fully processed
        setTimeout(() => {
          onPageDimensionsReady()
        }, 100)
      }

      return newMap
    })
  }



  // Track initial annotations for conversion - ONLY convert when they actually change
  const [lastProcessedInitialAnnotations, setLastProcessedInitialAnnotations] = useState<string>('')
  const [hasUserAddedAnnotations, setHasUserAddedAnnotations] = useState(false)

  // REMOVED: Redundant annotation processing that was causing race conditions

  // Convert when page dimensions are available
  useEffect(() => {
    if (annotations.length > 0 && pagesDimensions.size > 0) {
      const hasZeroCoordinates = annotations.some(ann =>
        ann.type === 'signature' && ann.x === 0 && ann.y === 0 && ann.width === 0 && ann.height === 0
      )

      if (hasZeroCoordinates) {
        console.log('Converting signatures with page dimensions')
        const convertedAnnotations = convertAnnotationsRelativeToAbsolute(annotations)
        setAnnotations(convertedAnnotations)
      }
    }
  }, [pagesDimensions.size])

  // WAIT FOR REAL PAGE DIMENSIONS: Never use fallbacks - wait for actual PDF page dimensions
  const preloadSignaturePageDimensions = useCallback(async () => {
    if (!initialAnnotations.length) return

    const signaturePages = initialAnnotations
      .filter(ann => ann.type === 'signature')
      .map(ann => ann.page)
      .filter((page, index, arr) => arr.indexOf(page) === index) // unique pages

    console.log('🔄 WAIT FOR REAL DIMENSIONS: Signature pages that need actual PDF dimensions:', signaturePages)

    // ELIMINATED FALLBACKS: Never use fallback dimensions - they cause coordinate mismatches
    // All pages MUST have their real PDF dimensions before annotations can be placed
    for (const pageNum of signaturePages) {
      if (!pagesDimensions.has(pageNum)) {
        console.log(`📄 REQUIRED: Page ${pageNum} needs real PDF dimensions - no fallbacks allowed`)
        // Don't set any fallback dimensions - force the system to wait for real ones
      }
    }

    console.log('🎯 ONE METHOD: Only real PDF dimensions will be used - no fallbacks!')
  }, [initialAnnotations, pagesDimensions])

  // REMOVED: Automatic page cycling that was causing jarring UX and page jumps
  // Instead, let signatures load naturally when user navigates to their pages

  // SINGLE ANNOTATION CONVERSION LOGIC: Consolidated and race-condition safe
  useEffect(() => {
    const currentKey = JSON.stringify(initialAnnotations)

    // Only process if annotations actually changed and we haven't started adding our own
    if (currentKey !== lastProcessedInitialAnnotations && !hasUserAddedAnnotations) {
      if (initialAnnotations.length === 0) {
        setAnnotations([])
        setLastProcessedInitialAnnotations(currentKey)
        return
      }

      // Check if we have dimensions for all signature pages before converting
      const signaturePages = initialAnnotations
        .filter(ann => ann.type === 'signature')
        .map(ann => ann.page)
        .filter((page, index, arr) => arr.indexOf(page) === index) // unique pages

      const hasAllRequiredDimensions = signaturePages.length === 0 ||
        signaturePages.every(page => pagesDimensions.has(page))

      if (hasAllRequiredDimensions && pagesDimensions.size > 0) {
        console.log('✅ CONSOLIDATED: Converting annotations with all required page dimensions')
        const convertedAnnotations = convertAnnotationsRelativeToAbsolute(initialAnnotations)
        console.log('📊 CONSOLIDATED: Converted annotations:', convertedAnnotations.length)

        setAnnotations(convertedAnnotations)
        setLastProcessedInitialAnnotations(currentKey)

        // Set original signatures for change tracking
        const signatures = (initialAnnotations || []).filter(a => a.type === 'signature')
        setOriginalSignatures(signatures)
        
        // Navigate to the first signature page ONCE to ensure it's visible
        if (!hasAutoNavigatedToFirstSignaturePageRef.current && signaturePages.length > 0) {
          const firstSignaturePage = Math.min(...signaturePages)
          if (firstSignaturePage !== currentPage) {
            setCurrentPage(firstSignaturePage)
          }
          hasAutoNavigatedToFirstSignaturePageRef.current = true
        }
      } else {
        console.log('⏳ CONSOLIDATED: Waiting for page dimensions, attempting to preload:', {
          signaturePages,
          availableDimensions: Array.from(pagesDimensions.keys())
        })
        
        // Do NOT auto-navigate on dimension changes; just preload to avoid jarring page jumps
        
        // Trigger preload of signature page dimensions
        preloadSignaturePageDimensions().catch(error => {
          console.error('Failed to preload signature page dimensions:', error)
        })
      }
    }
  }, [initialAnnotations, pagesDimensions.size, hasUserAddedAnnotations, lastProcessedInitialAnnotations, preloadSignaturePageDimensions])

  // REMOVED: Second redundant page dimension trigger that was causing race conditions









  // Add effect to handle goToPage event from sidebar
  useEffect(() => {
    const handleGoToPage = (event: CustomEvent) => {
      const { page } = event.detail
      if (page && page >= 1 && page <= numPages) {
        setCurrentPage(page)
        console.log(`📄 Navegando a página ${page} de ${numPages}`)
      }
    }

    window.addEventListener('goToPage', handleGoToPage as EventListener)
    return () => window.removeEventListener('goToPage', handleGoToPage as EventListener)
  }, [numPages])

  // Check for signature changes
  const hasSignatureChanges = () => {
    if (!annotations || !Array.isArray(annotations) || !originalSignatures || !Array.isArray(originalSignatures)) {
      return false
    }
    const currentSignatures = annotations.filter(a => a.type === 'signature')

    // Check if number of signatures changed
    if (currentSignatures.length !== originalSignatures.length) {
      return true
    }

    // Check if any signature was modified
    for (const current of currentSignatures) {
      const original = originalSignatures.find(o => o.id === current.id)
      if (!original) {
        return true // New signature
      }

      // Check if position or size changed
      if (
        original.x !== current.x ||
        original.y !== current.y ||
        original.width !== current.width ||
        original.height !== current.height
      ) {
        return true
      }
    }

    // Check if any signature was deleted
    for (const original of originalSignatures) {
      if (!currentSignatures.find(c => c.id === original.id)) {
        return true // Signature was deleted
      }
    }

    return false
  }

  // Update hasUnsavedChanges when annotations change
  useEffect(() => {
    setHasUnsavedChanges(hasSignatureChanges())
  }, [annotations, originalSignatures])



  // ✅ AUTO-SAVE RESTAURADO Y CORREGIDO
  // Sync annotation changes with parent component (Fast Sign mode only)
  // This only syncs state for UI purposes, doesn't save to database
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
        // In assignment mapping mode, sync with parent component via event handlers only
    if (internalMappingMode) {
      annotationsRef.current = annotations
      return
    }

    // Only sync if we're in Fast Sign mode (no token)
    if (!token) {
      // Check if annotations actually changed (not just a re-render)
      const hasChanged = JSON.stringify(annotations) !== JSON.stringify(annotationsRef.current)

      if (hasChanged) {
        // Sync with parent (debug logs suppressed)

        annotationsRef.current = annotations

        // Clear any pending save timeout
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
        }

        // Debounce the save to prevent multiple rapid saves
        saveTimeoutRef.current = setTimeout(() => {
          // Only save if the component is still mounted and annotations haven't changed again
          if (JSON.stringify(annotations) === JSON.stringify(annotationsRef.current)) {
            console.log('💾 PDF Editor: Syncing annotations to parent component')
            onSave(annotations)
          }
        }, 300) // 300ms debounce
      }
    } else {
      annotationsRef.current = annotations
    }

    // Cleanup function
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [annotations, token, onSave, internalMappingMode])

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null) // Reset touchEnd
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    })
  }

  const handleTouchEnd = (e?: React.TouchEvent) => {
    // Handle swipe navigation
    if (!touchStart || !touchEnd) return

    const distanceX = touchStart.x - touchEnd.x
    const distanceY = touchStart.y - touchEnd.y
    const isLeftSwipe = distanceX > minSwipeDistance
    const isRightSwipe = distanceX < -minSwipeDistance
    const isVerticalSwipe = Math.abs(distanceY) > Math.abs(distanceX)

    // Skip navigation if in signature placement mode
    if (currentTool === "signature") return

    // Use horizontal swipes for page navigation
    if (!isVerticalSwipe) {
      if (isLeftSwipe && currentPage < (numPages || 1)) {
        setCurrentPage(prev => prev + 1)
      }
      if (isRightSwipe && currentPage > 1) {
        setCurrentPage(prev => prev - 1)
      }
    }
  }

  // Handle tool selection
  const handleToolChange = (tool: "select" | "signature" | "text") => {


    if (tool === "signature") {
      if (internalMappingMode) {
        // Mapping mode: directly activate signature placement tool for field creation
        console.log('📍 Mapping mode: activating signature placement tool')
        setCurrentTool("signature")
      } else if (!token) {
        // Fast-sign mode: show full signature modal with Wacom support

        setShowSignatureModal(true)
        // currentTool will be set in handleSignatureComplete
      } else {
        // Use simple canvas for authenticated users (with token)
        console.log('🖌️ Authenticated mode: showing simple canvas')
        setShowSimpleCanvas(true)
        setCurrentTool("select") // Keep select tool active until signature is created
      }
    } else {
      setCurrentTool(tool)
    }
    setSelectedAnnotation(null)
  }

  // Load the PDF just to read how many pages it has so we can size the canvas
  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          // pdf.js is only needed on the client for counting pages. We load it dynamically in useEffect to avoid
          // Node18 incompatibility (Promise.withResolvers is only in Node20+).
          const pdfModule = await import("react-pdf")
          const pdfjs = pdfModule.pdfjs

          // Ensure the Web-Worker path is configured; otherwise pdf.js will try to
          // import "pdf.worker.mjs" which Next cannot resolve in the browser.
          if (pdfjs.GlobalWorkerOptions && (!pdfjs.GlobalWorkerOptions.workerSrc || pdfjs.GlobalWorkerOptions.workerSrc === '')) {
            pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
          }

          // Ensure worker is properly initialized before loading document
          await new Promise(resolve => setTimeout(resolve, 100))

          const loadingTask = pdfjs.getDocument({
            url: documentUrl.split('#')[0],
            cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/'
          })

          const pdf = await loadingTask.promise
          if (!cancelled) {
            setNumPages(pdf.numPages)
          }
        } catch (err) {
          console.error("Failed to load PDF for page count", err)
          if (!cancelled) {
            // Fallback to 1 page if we can't load the PDF
            setNumPages(1)
          }
        }
      })()

    return () => {
      cancelled = true
    }
  }, [documentUrl])

  // Configure PDF.js worker when component mounts
  useEffect(() => {
    const configurePdfWorker = async () => {
      try {
        // Ensure Promise.withResolvers polyfill is applied
        if (typeof (Promise as any).withResolvers !== "function") {
          const polyfill = function withResolvers<T = any>() {
            let resolveFn: (value: T | PromiseLike<T>) => void
            let rejectFn: (reason?: any) => void
            const promise = new Promise<T>((res, rej) => {
              resolveFn = res
              rejectFn = rej
            })
            return { promise, resolve: resolveFn!, reject: rejectFn! }
          }
          Object.defineProperty(Promise, "withResolvers", {
            value: polyfill,
            writable: true,
            configurable: true,
          })
        }

        // Import pdfjs from react-pdf
        const { pdfjs } = await import("react-pdf")

        // Configure worker with multiple fallback options
        const workerSources = [
          '/pdf.worker.min.mjs',
          '/pdf.worker.mjs',
          'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs',
          'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.mjs'
        ]

        let workerConfigured = false
        for (const workerSrc of workerSources) {
          try {
            // Test if worker source is available
            const response = await fetch(workerSrc, { method: 'HEAD' })
            if (response.ok) {
              pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

              workerConfigured = true
              break
            }
          } catch (e) {
            console.warn(`Worker source ${workerSrc} not available:`, e)
          }
        }

        if (!workerConfigured) {
          console.warn("No PDF.js worker source available, PDF rendering may fail")
          // Force set to the most likely working option
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        }

      } catch (err) {
        console.error("Failed to configure PDF worker:", err)
        // Fallback configuration
        try {
          const { pdfjs } = await import("react-pdf")
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        } catch (fallbackErr) {
          console.error("Failed to configure PDF worker fallback:", fallbackErr)
        }
      }
    }
    configurePdfWorker()
  }, [])

  // Listen for PDF page dimension events to trigger signature recalculation
  useEffect(() => {
    const handlePageDimensionsReady = () => {
      console.log('PdfAnnotationEditor: PDF page dimensions ready event received - forcing annotation recalculation')
      // Force re-conversion of annotations to trigger position recalculation
      setAnnotations(prev => [...prev])
    }

    window.addEventListener('pdf-page-dimensions-ready', handlePageDimensionsReady)
    return () => window.removeEventListener('pdf-page-dimensions-ready', handlePageDimensionsReady)
  }, [])

  // Convert screen coordinates to document-relative coordinates (0-1 range)
  const getDocumentRelativeCoordinates = (e: React.MouseEvent<HTMLDivElement>) => {
    const documentElement = documentRef.current
    if (!documentElement) return null

    const rect = documentElement.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const pageHeight = rect.height / numPages
    const page = Math.floor(y / pageHeight) + 1

    // Relative within page (0-1)
    const relativeX = x / rect.width
    const relativeY = (y - (page - 1) * pageHeight) / pageHeight

    return { relativeX, relativeY, absoluteX: x, absoluteY: y, page }
  }

  // Convert relative coordinates back to absolute coordinates
  const getAbsoluteCoordinates = (relativeX: number, relativeY: number, page: number = 1) => {
    const documentElement = documentRef.current
    if (!documentElement) return { x: 0, y: 0 }

    const rect = documentElement.getBoundingClientRect()
    const pageHeight = rect.height / numPages
    return {
      x: relativeX * rect.width,
      y: ((page - 1) + relativeY) * pageHeight,
    }
  }

  // Simplified drag detection - no complex click validation needed

  // Handle container interaction with proper click-vs-drag detection
  const handleContainerInteraction = (pageNumber: number, pageInfo?: any, clientX?: number, clientY?: number, event?: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) {
      return
    }

    if (!containerRef.current || !pageInfo) {
      return
    }

    // Check if components are ready for Fast Sign mode (when onPageDimensionsReady is provided)
    if (onPageDimensionsReady && pagesDimensions.size === 0) {
      console.log('⚠️ Fast Sign: Document not ready for interaction yet')
      return
    }

    // Only process this interaction if we're in signature or text mode
    if (currentTool !== "signature" && currentTool !== "text") {
      return
    }

    // CRITICAL: Ensure page dimensions are loaded before allowing signature placement
    const targetPageDimensions = pagesDimensions.get(pageNumber)
    if (!targetPageDimensions) {
      console.log('🚫 Signature placement blocked - page dimensions not loaded yet for page', pageNumber)
      console.log('🔄 Available page dimensions:', Array.from(pagesDimensions.keys()))
      return
    }

    // BOUNDARY CHECKS DISABLED - System was not aligned with React PDF dimensions
    // Especially problematic with landscape documents on the right side
    // const documentWidth = targetPageDimensions.originalWidth
    // const documentHeight = targetPageDimensions.originalHeight

    // Calculate click coordinates for boundary checking - DISABLED
    // let clickXForBoundaryCheck: number
    // let clickYForBoundaryCheck: number

    // if (pageInfo.originalClickX !== undefined && pageInfo.originalClickY !== undefined) {
    //   clickXForBoundaryCheck = pageInfo.originalClickX
    //   clickYForBoundaryCheck = pageInfo.originalClickY
    // } else if (pageInfo.clickX !== undefined && pageInfo.clickY !== undefined) {
    //   // Scale down the click coordinates to original page size for boundary check
    //   const scale = pageInfo.scale || 1
    //   clickXForBoundaryCheck = pageInfo.clickX / scale
    //   clickYForBoundaryCheck = pageInfo.clickY / scale
    // } else {
    //   // If no click coordinates available, use center coordinates
    //   clickXForBoundaryCheck = documentWidth / 2
    //   clickYForBoundaryCheck = documentHeight / 2
    // }

    // Check if click is outside document bounds - DISABLED
    // The boundary detection system was not properly aligned with React PDF's coordinate system
    // if (clickXForBoundaryCheck < 0 || clickXForBoundaryCheck > documentWidth ||
    //   clickYForBoundaryCheck < 0 || clickYForBoundaryCheck > documentHeight) {
    //   console.log('🚫 Signature placement blocked - click outside document boundaries')
    //   console.log('🔍 Click position:', { x: clickXForBoundaryCheck, y: clickYForBoundaryCheck })
    //   console.log('🔍 Document bounds:', { width: documentWidth, height: documentHeight })

    //   toast({
    //     title: "No se puede añadir firma",
    //     description: "Las firmas solo se pueden colocar dentro de los límites del documento.",
    //     duration: 3000,
    //     variant: "destructive"
    //   })
    //   return
    // }

    // PREVENT SIGNATURE CREATION DURING DRAG OPERATIONS
    if (isDraggingAnnotation) {

      return
    }

    // DEBOUNCING: Prevent multiple rapid signature placements (anti-double-click)
    if (currentTool === "signature" && isPlacingSignature) {
      console.log('🚫 Signature placement blocked - already placing a signature (debouncing)')
      console.warn("Please wait - Wait a moment before placing another signature.")
      return
    }

    if (currentTool === "signature") {
      const signatureWidth = 150  // Bigger default size for better visibility
      const signatureHeight = 75  // Bigger default size for better visibility

      // ENSURE PAGE DIMENSIONS: Load immediately if not available
      let pageDimensions = pagesDimensions.get(pageNumber)
      if (!pageDimensions && pageInfo) {
        console.log(`📏 LOADING: Page ${pageNumber} dimensions not found, loading immediately from pageInfo`)
        const dimensions = getUnifiedPageDimensions(pageInfo, pageInfo.scale || 1.0)
        setPagesDimensions(prev => new Map(prev.set(pageNumber, dimensions)))
        pageDimensions = dimensions
        console.log(`📏 LOADED: Page ${pageNumber} dimensions:`, dimensions)
      }

      if (!pageDimensions) {
        console.warn('🚫 No page dimensions available for signature placement - using defaults')
        // 🚨 USE DISPLAY DIMENSIONS if available from PDF-lib properties
        let displayWidth = pageInfo?.pdfLibProperties?.width || pageInfo?.originalWidth || 612
        let displayHeight = pageInfo?.pdfLibProperties?.height || pageInfo?.originalHeight || 792
        const originalWidth = pageInfo?.pdfLibProperties?.originalWidth || pageInfo?.originalWidth || 612  
        const originalHeight = pageInfo?.pdfLibProperties?.originalHeight || pageInfo?.originalHeight || 792

        console.log(`📏 FALLBACK: Creating page ${pageNumber} dimensions:`, {
          fromPageInfo: {
            width: pageInfo?.width, // This is scaled!
            height: pageInfo?.height, // This is scaled!
            originalWidth: pageInfo?.originalWidth, // This is what we want
            originalHeight: pageInfo?.originalHeight, // This is what we want
            scale: pageInfo?.scale
          },
          usingDimensions: { originalWidth, originalHeight },
          note: 'Using ONLY original dimensions, never scaled ones'
        })

        pageDimensions = {
          width: originalWidth,
          height: originalHeight,
          originalWidth: originalWidth,
          originalHeight: originalHeight,
          displayWidth,
          displayHeight,
          scale: pageInfo?.scale || 1.0
        }
      }

      // 🎯 CRITICAL FIX: Use corrected dimensions for scanned documents
      const originalWidth = pageInfo.pdfLibProperties?.width || pageDimensions.originalWidth
      const originalHeight = pageInfo.pdfLibProperties?.height || pageDimensions.originalHeight

      // EXACT CLICK POSITIONING: Use pre-calculated original coordinates (already scaled)
      const scale = pageInfo.scale || 1

      // SIMPLIFIED COORDINATES: Use reliable click coordinates from pageInfo
      let clickX, clickY

      // Use screen coordinates directly without conversion
      if (pageInfo.clickX !== undefined && pageInfo.clickY !== undefined) {
        // Use the screen coordinates directly (they are already in the correct scale)
        clickX = pageInfo.clickX / scale
        clickY = pageInfo.clickY / scale
      } else if (pageInfo.originalClickX !== undefined && pageInfo.originalClickY !== undefined) {
        clickX = pageInfo.originalClickX
        clickY = pageInfo.originalClickY
      } else {
        // Fallback to center of page
        clickX = originalWidth / 2
        clickY = originalHeight / 2
      }

      // CENTER SIGNATURE ON CLICK: Center signature on click point for intuitive placement
      const centeredX = clickX - (signatureWidth / 2)
      const centeredY = clickY - (signatureHeight / 2)

      // RESTORE BOUNDS WITH DETAILED LOGGING
      const boundedX = Math.max(0, Math.min(centeredX, originalWidth - signatureWidth))
      const boundedY = Math.max(0, Math.min(centeredY, originalHeight - signatureHeight))





      if (internalMappingMode) {
        // DEBOUNCING: Set placing flag to prevent rapid clicks
        setIsPlacingSignature(true)

        // USE SIMPLE TOP-LEFT COORDINATES: Store coordinates as they appear on screen
        const newSignatureField: Annotation = {
          id: crypto.randomUUID(),
          type: "signature",
          x: boundedX,  // Store screen X coordinate
          y: boundedY,  // Store screen Y coordinate (top-left based)
          width: signatureWidth,
          height: signatureHeight,
          content: `${(annotations || []).filter(a => a.type === "signature").length + 1}`,
          page: pageNumber,
          timestamp: new Date().toISOString(),
          // 🎯 CRITICAL FIX: Use display dimensions for rotated pages
          relativeX: boundedX / getDisplayWidth(pageDimensions, originalWidth),
          relativeY: boundedY / getDisplayHeight(pageDimensions, originalHeight),
          relativeWidth: signatureWidth / getDisplayWidth(pageDimensions, originalWidth),
          relativeHeight: signatureHeight / getDisplayHeight(pageDimensions, originalHeight)
        }

        setAnnotations(prev => [...prev, newSignatureField])
        setSelectedAnnotation(newSignatureField.id)
        setHasUnsavedChanges(true)
        setHasUserAddedAnnotations(true) // Mark user activity

        // DEBOUNCING: Reset placing flag after 1 second to prevent accidental double-clicks
        setTimeout(() => {
          setIsPlacingSignature(false)
          console.log('🔓 Signature field placement debounce cleared - ready for next field')
        }, 1000)
        console.log('📍 Mapping: Added signature field placeholder')

      } else if (pendingSignature) {
        // DEBOUNCING: Set placing flag to prevent rapid clicks
        setIsPlacingSignature(true)

        // USE SIMPLE TOP-LEFT COORDINATES: Store coordinates as they appear on screen
        const newSignature: Annotation = {
          id: crypto.randomUUID(),
          type: "signature",
          x: boundedX,  // Store screen X coordinate
          y: boundedY,  // Store screen Y coordinate (top-left based)
          width: signatureWidth,
          height: signatureHeight,
          imageData: pendingSignature.dataUrl,
          signatureSource: pendingSignature.source,
          page: pageNumber,
          timestamp: pendingSignature.timestamp,
          // 🎯 CRITICAL FIX: Use display dimensions for rotated pages (pending signature)
          relativeX: boundedX / getDisplayWidth(pageDimensions, originalWidth),
          relativeY: boundedY / getDisplayHeight(pageDimensions, originalHeight),
          relativeWidth: signatureWidth / getDisplayWidth(pageDimensions, originalWidth),
          relativeHeight: signatureHeight / getDisplayHeight(pageDimensions, originalHeight),
          // CRITICAL: Store true PDF dimensions for accurate saving
          sourcePageDimensions: pageInfo?.truePdfDimensions || {
            width: originalWidth,
            height: originalHeight,
            orientation: originalWidth > originalHeight ? 'LANDSCAPE' : 'PORTRAIT',
            aspectRatio: originalWidth / originalHeight
          }
        }



        // Only clear pending signature if persistent mode is disabled
        if (!persistentSignatureMode) {
          setPendingSignature(null)
          setCurrentTool("select")
          console.log('🧹 Cleared pending signature (persistent mode disabled)')
        } else {

          // Keep signature tool active for continuous use
          setCurrentTool("signature")
        }

        // Add the new signature to the annotations array

        setAnnotations(prev => {
          const newAnnotations = [...prev, newSignature]

          return newAnnotations
        })

        // CRITICAL: Notify parent component of changes (moved outside state updater)

        const newAnnotations = [...annotations, newSignature]
        
        // In assignment mapping mode, always sync with parent component
        console.log('📍 ASSIGNMENT PDF EDITOR: New annotation - syncing with parent')
        onSave(newAnnotations)

        // Mark that user has added annotations to prevent initial conversion override
        setHasUserAddedAnnotations(true)

        // DON'T navigate to signature page - stay on current page to avoid jarring UX
        // User should stay on the page they're working on


        // Auto-select the newly added signature
        setSelectedAnnotation(newSignature.id)

        setHasUnsavedChanges(true)


        // DEBOUNCING: Reset placing flag after 1 second to prevent accidental double-clicks
        setTimeout(() => {
          setIsPlacingSignature(false)

        }, 1000)
      } else {
        // NO PENDING SIGNATURE IN FAST-SIGN MODE: Do nothing or show message

        toast({
          title: "No signature to place",
          description: "Please create a signature first by clicking 'Añadir Firma'",
          duration: 3000,
        })
        return
      }
    } else if (currentTool === "text") {
      const textWidth = 120  // Smaller default width
      const textHeight = 30  // Smaller default height

      // FIXED: Use the same corrected approach as signatures
      const scale = pageInfo.scale || 1

      // ENSURE TARGET PAGE DIMENSIONS: Load immediately if not available
      let targetPageDimensions = pagesDimensions.get(pageNumber)
      if (!targetPageDimensions && pageInfo) {
        console.log(`📏 TEXT LOADING: Page ${pageNumber} dimensions not found, loading immediately from pageInfo`)
        const dimensions = getUnifiedPageDimensions(pageInfo, pageInfo.scale || 1.0)
        setPagesDimensions(prev => new Map(prev.set(pageNumber, dimensions)))
        targetPageDimensions = dimensions
      }

      // Get TARGET PAGE dimensions for reference - use display dimensions when available
      const fallbackWidth = targetPageDimensions?.displayWidth || targetPageDimensions?.originalWidth || pageInfo?.pdfLibProperties?.width || pageInfo?.originalWidth || 612
      const fallbackHeight = targetPageDimensions?.displayHeight || targetPageDimensions?.originalHeight || pageInfo?.pdfLibProperties?.height || pageInfo?.originalHeight || 792

      console.log(`📝 TEXT DIMENSIONS for page ${pageNumber}:`, {
        fromTargetPageDimensions: targetPageDimensions,
        fromPageInfo: {
          originalWidth: pageInfo?.originalWidth,
          originalHeight: pageInfo?.originalHeight,
          scaledWidth: pageInfo?.width, // Don't use these!
          scaledHeight: pageInfo?.height // Don't use these!
        },
        usingDimensions: { fallbackWidth, fallbackHeight }
      })

      // WORKING COORDINATES: Use the pre-calculated original coordinates from EnhancedPdfPageWithOverlay with corrected dimensions
      const originalClickX = pageInfo.originalClickX || (pageInfo.clickX ? pageInfo.clickX / scale : fallbackWidth / 2)
      const originalClickY = pageInfo.originalClickY || (pageInfo.clickY ? pageInfo.clickY / scale : fallbackHeight / 2)

      // NO BOUNDARY CHECKS - users can place text anywhere they want

      // Center text box on click point in original coordinates
      const centeredX = originalClickX - (textWidth / 2)
      const centeredY = originalClickY - (textHeight / 2)

      // Use consistent page dimensions (same as signatures)
      const originalWidth = fallbackWidth
      const originalHeight = fallbackHeight

      // NO BOUNDS - users can place text anywhere
      const boundedX = centeredX
      const boundedY = centeredY

      console.log(`📝 TEXT CLICK DEBUG for page ${pageNumber}:`, {
        clickCoordinates: {
          originalClick: { x: originalClickX, y: originalClickY },
          centeredOnClick: { x: centeredX, y: centeredY },
          finalPosition: { x: boundedX, y: boundedY }
        },
        pageGeometry: {
          originalSize: { width: originalWidth, height: originalHeight },
          scale: scale
        },
        note: 'Text uses top-left coordinate system (different from signatures PDF system)'
      })

      const newTextBox: Annotation = {
        id: crypto.randomUUID(),
        type: "text",
        x: boundedX,
        y: boundedY,
        width: textWidth,
        height: textHeight,
        content: "",
        page: pageNumber,
        timestamp: new Date().toISOString(),
        fontSize: 12, // Default font size
        // 🎯 CRITICAL FIX: Use display dimensions for rotated pages (text annotation)
        relativeX: boundedX / getDisplayWidth(targetPageDimensions, originalWidth),
        relativeY: boundedY / getDisplayHeight(targetPageDimensions, originalHeight),
        relativeWidth: textWidth / getDisplayWidth(targetPageDimensions, originalWidth),
        relativeHeight: textHeight / getDisplayHeight(targetPageDimensions, originalHeight)
      }



      setAnnotations(prev => {
        const newAnnotations = [...prev, newTextBox]

        // State will be synced with parent via useEffect

        return newAnnotations
      })

      setHasUnsavedChanges(true)
      setHasUserAddedAnnotations(true) // Mark user activity
    }
  }

  // Legacy mouse handler for backward compatibility
  const handleContainerClick = (e: React.MouseEvent<Element>, pageNumber: number, pageInfo?: any) => {
    // Handle mapping mode specially
    if (internalMappingMode && currentTool === "signature") {
      // In mapping mode, create a signature marker at the clicked position
      if (pageInfo) {
        let x, y, relativeX, relativeY, finalX, finalY;
        
        // Define signature dimensions
        const signatureWidth = 150
        const signatureHeight = 75
        
        // Check if we have enhanced pageInfo from pdf-lib system
        if (pageInfo.pdfLibProperties && pageInfo.clickX !== undefined && pageInfo.clickY !== undefined) {
          // Use the screen coordinates from enhanced system (already properly scaled)
          console.log('🎯 SIGNATURE PROCESSING - Enhanced System:', {
            screenClick: { x: pageInfo.clickX, y: pageInfo.clickY },
            scale: pageInfo.scale,
            pageProps: pageInfo.pdfLibProperties
          })
          
          // Use screen coordinates and convert to PDF coordinates properly
          const screenX = pageInfo.clickX
          const screenY = pageInfo.clickY
          
          // Convert screen coordinates to PDF coordinate space by dividing by scale
          const pdfX = screenX / scale
          const pdfY = screenY / scale
          
          // Center the signature box on the click point (in PDF coordinate space)
          finalX = pdfX - (signatureWidth / 2)
          finalY = pdfY - (signatureHeight / 2)
          
          // Calculate relative coordinates using proper dimensions
          const overlayWidth = pageInfo.pdfLibProperties.originalWidth
          const overlayHeight = pageInfo.pdfLibProperties.originalHeight
          
          relativeX = finalX / overlayWidth
          relativeY = finalY / overlayHeight

          // Debug final signature coordinates using organized debug utility
          logSignatureCoordinateDebug({
            documentType: pageInfo.pdfLibProperties.isScannedDocument ? 'scanned' : 'pc-created',
            stage: 'frontend-drop',
            pageProperties: {
              width: pageInfo.pdfLibProperties.width || overlayWidth,
              height: pageInfo.pdfLibProperties.height || overlayHeight,
              orientation: pageInfo.pdfLibProperties.orientation,
              isScannedDocument: pageInfo.pdfLibProperties.isScannedDocument || false,
              correctionApplied: pageInfo.pdfLibProperties.scannedOrientationCorrectionApplied || false
            },
            coordinates: {
              screen: { x: pageInfo.clickX, y: pageInfo.clickY },
              absolute: { x: finalX, y: finalY, width: signatureWidth, height: signatureHeight },
              relative: { x: relativeX, y: relativeY, width: signatureWidth / overlayWidth, height: signatureHeight / overlayHeight }
            },
            metadata: {
              dimensionsUsed: { width: overlayWidth, height: overlayHeight },
              scale: pageInfo.scale,
              note: 'Final coordinates to be sent to backend for merging'
            }
          })
        } else {
          // Fallback to manual calculation (less accurate)
          console.warn('⚠️ Using fallback coordinate calculation - may be less accurate')
          const rect = e.currentTarget.getBoundingClientRect()
          x = e.clientX - rect.left
          y = e.clientY - rect.top
          
          // Scale the coordinates to account for PDF zoom
          const scaledX = x / scale
          const scaledY = y / scale
          
          // Center the signature box on the click point
          finalX = scaledX - (signatureWidth / 2)
          finalY = scaledY - (signatureHeight / 2)
          
          const pageDimensions = pagesDimensions.get(pageNumber)
          // 🎯 CRITICAL FIX: Use corrected dimensions for scanned documents
          const referenceWidth = pageInfo.pdfLibProperties?.width || pageInfo.originalWidth || 612
          const referenceHeight = pageInfo.pdfLibProperties?.height || pageInfo.originalHeight || 792
          const displayWidth = getDisplayWidth(pageDimensions, referenceWidth)
          const displayHeight = getDisplayHeight(pageDimensions, referenceHeight)
          
          relativeX = finalX / displayWidth
          relativeY = finalY / displayHeight
        }
        
        // Create a signature marker (without imageData)
        const newSignature: Annotation = {
          id: crypto.randomUUID(),
          type: "signature",
          x: finalX,  // Use calculated coordinates (centered on click)
          y: finalY,  // Use calculated coordinates (centered on click)
          width: signatureWidth, // Use defined signature width
          height: signatureHeight, // Use defined signature height
          page: pageNumber,
          relativeX,
          relativeY,
          relativeWidth: signatureWidth / (pageInfo.pdfLibProperties?.width || pageInfo.originalWidth || 612),
          relativeHeight: signatureHeight / (pageInfo.pdfLibProperties?.height || pageInfo.originalHeight || 792),
          imageData: "", // No image in mapping mode - just position marker
          timestamp: new Date().toISOString()
        }
        

        
        setAnnotations(prev => [...prev, newSignature])
        setHasUnsavedChanges(true)
      }
      return
    }

    // If we're not in signature or text mode, just deselect any selected annotation
    if (currentTool !== "signature" && currentTool !== "text") {
      setSelectedAnnotation(null)
      return
    }

    handleContainerInteraction(pageNumber, pageInfo, e.clientX, e.clientY, e)
  }

  // Touch handler for mobile devices
  const handleContainerTouch = (e: React.TouchEvent<Element>, pageNumber: number, pageInfo?: any) => {
    e.preventDefault() // Prevent default touch behavior
    
    // Handle mapping mode specially
    if (internalMappingMode && currentTool === "signature") {
      const touch = e.touches[0] || e.changedTouches[0]
      if (touch) {
        // In mapping mode, create a signature marker at the touched position
        const rect = e.currentTarget.getBoundingClientRect()
        const x = touch.clientX - rect.left
        const y = touch.clientY - rect.top
        
        if (pageInfo) {
          const { originalWidth, originalHeight } = pageInfo
          // 🎯 CRITICAL FIX: Use display dimensions for rotated pages (mapping mode touch)
          const pageDimensions = pagesDimensions.get(pageNumber)
          const displayWidth = getDisplayWidth(pageDimensions, pageInfo.originalWidth || 612)
          const displayHeight = getDisplayHeight(pageDimensions, pageInfo.originalHeight || 792)
          
          const relativeX = x / displayWidth
          const relativeY = y / displayHeight
          
          // Create a signature marker (without imageData)
          const newSignature: Annotation = {
            id: crypto.randomUUID(),
            type: "signature",
            x: x,  // Use actual screen coordinates
            y: y,  // Use actual screen coordinates
                      width: 150, // Default signature width
          height: 75, // Default signature height
          page: pageNumber,
          relativeX,
          relativeY,
          relativeWidth: 150 / displayWidth,
          relativeHeight: 75 / displayHeight,
            imageData: "", // No image in mapping mode - just position marker
            timestamp: new Date().toISOString()
          }
          
          setAnnotations(prev => [...prev, newSignature])
          setHasUnsavedChanges(true)
        }
      }
      return
    }

    const touch = e.touches[0] || e.changedTouches[0]
    if (touch) {
      handleContainerInteraction(pageNumber, pageInfo, touch.clientX, touch.clientY, e)
    }
  }

  // Handle signature completion
  const handleSignatureComplete = (dataUrl: string, source: 'canvas' | 'wacom') => {

    setShowSignatureModal(false)

    if (!dataUrl) return

    // Store the signature and show placement instruction
    setPendingSignature({
      dataUrl,
      source,
      timestamp: new Date().toISOString()
    })

    setCurrentTool("signature") // Activate signature placement tool

    // Always keep persistent mode enabled when new signature is created
    setPersistentSignatureMode(true)
  }

  // Helper function to safely change tool without interfering with persistent mode
  const safeSetCurrentTool = (newTool: "select" | "signature" | "text") => {
    // If persistent mode is active and we have a pending signature, don't change from signature tool
    if (persistentSignatureMode && pendingSignature && currentTool === "signature" && newTool === "select") {
      console.log('🔒 Prevented tool change to select - persistent mode is active')
      return
    }
    setCurrentTool(newTool)
  }

  // Clear pending signature (allow user to change signature)
  const handleClearPendingSignature = () => {
    setPendingSignature(null)
    setPersistentSignatureMode(false) // Disable persistent mode when clearing
    setCurrentTool("select")
    console.log('🧹 Cleared pending signature and disabled persistent mode')
  }

  // Handle simple canvas completion (for unauthenticated users)
  const handleSimpleCanvasComplete = (dataUrl: string) => {
    console.log('🖊️ Simple canvas completed:', { dataUrl: !!dataUrl })
    setShowSimpleCanvas(false)

    if (!dataUrl) return

    // Store the signature and show placement instruction
    setPendingSignature({
      dataUrl,
      source: 'canvas',
      timestamp: new Date().toISOString()
    })

    setCurrentTool("signature") // Activate signature placement tool

    // Always keep persistent mode enabled when new signature is created
    setPersistentSignatureMode(true)
  }

  // Auto-save signature when placed
  const saveSignatureToDatabase = async (signature: Annotation) => {
    // Skip database operations for Fast Sign (when no token is provided)
    if (!token) {
      setLastSaved(new Date())
      return
    }

    try {
      // Save signature with coordinate debugging info
      console.log('💾 Saving signature to database with coordinates:', {
        signature: {
          id: signature.id,
          x: signature.x,
          y: signature.y,
          width: signature.width,
          height: signature.height,
          page: signature.page,
          relativeX: signature.relativeX,
          relativeY: signature.relativeY,
          relativeWidth: signature.relativeWidth,
          relativeHeight: signature.relativeHeight
        },
        editorPageDimensions: pagesDimensions.get(signature.page),
        note: 'Print API must use same page dimensions for correct positioning'
      })

      const signatureResponse = await fetch(`/api/documents/${documentId}/signature`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signatureDataUrl: signature.imageData,
          signatureSource: signature.signatureSource || 'canvas',
          token: token,
          position: {
            x: signature.x,
            y: signature.y,
            width: signature.width,
            height: signature.height,
            page: signature.page,
            relativeX: signature.relativeX,
            relativeY: signature.relativeY,
            relativeWidth: signature.relativeWidth,
            relativeHeight: signature.relativeHeight
          }
        }),
      })

      if (!signatureResponse.ok) {
        throw new Error("Failed to save signature to database")
      }

      const result = await signatureResponse.json()

      // Update the signature ID with the one from the database
      if (result.signature?.id) {
        setAnnotations(prevAnnotations =>
          prevAnnotations.map(ann =>
            ann.id === signature.id ? { ...ann, id: result.signature.id } : ann
          )
        )
      }

      // Remove success toast
      setLastSaved(new Date())
    } catch (error) {
      console.error("Error saving signature:", error)
      // Keep error toast for failures
      toast({
        title: "Failed to save signature",
        description: "There was an error saving your signature. Please try again.",
        duration: 5000,
        variant: "destructive"
      })
      throw error
    }
  }

  // Update signature position/size in database
  const updateSignatureInDatabase = async (signature: Annotation) => {
    // Skip database operations for Fast Sign (when no token is provided)
    if (!token) return

    try {
      const response = await fetch(`/api/documents/${documentId}/signature`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signatureId: signature.id,
          token: token,
          position: {
            x: signature.x,
            y: signature.y,
            width: signature.width,
            height: signature.height,
            page: signature.page,
            relativeX: signature.relativeX,
            relativeY: signature.relativeY,
            relativeWidth: signature.relativeWidth,
            relativeHeight: signature.relativeHeight
          }
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update signature position")
      }

      // Remove success toast
    } catch (error) {
      console.error("Error updating signature position:", error)
      // Keep error toast for failures
      toast({
        title: "Failed to update signature",
        description: "An error occurred while updating the signature position.",
        duration: 5000,
        variant: "destructive"
      })
    }
  }

  // Delete signature from database
  const deleteSignatureFromDatabase = async (signatureId: string) => {
    // Skip database operations for Fast Sign (when no token is provided)
    if (!token) return

    try {
      const response = await fetch(`/api/documents/${documentId}/signature`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signatureId: signatureId,
          token: token
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to delete signature")
      }

      // Remove success toast
    } catch (error) {
      console.error("Error deleting signature:", error)
      // Keep error toast for failures
      toast({
        title: "Failed to delete signature",
        description: "An error occurred while deleting the signature.",
        duration: 5000,
        variant: "destructive"
      })
    }
  }

  // Sync signatures with database
  const syncSignaturesWithDatabase = async () => {
    // Skip database operations for Fast Sign (when no token is provided)
    if (!token) {
      // For Fast Sign, just update the local state
      setOriginalSignatures([...annotations.filter(a => a.type === 'signature')])
      setHasUnsavedChanges(false)
      return
    }

    const currentSignatures = annotations.filter(a => a.type === 'signature')

    try {
      // 1. Handle deleted signatures
      for (const original of originalSignatures) {
        const stillExists = currentSignatures.find(c => c.id === original.id)
        if (!stillExists) {
          await deleteSignatureFromDatabase(original.id)
        }
      }

      // 2. Handle new and updated signatures
      for (const current of currentSignatures) {
        const original = originalSignatures.find(o => o.id === current.id)

        if (!original) {
          // New signature - save it
          await saveSignatureToDatabase(current)
        } else {
          // Check if signature was modified
          if (
            original.x !== current.x ||
            original.y !== current.y ||
            original.width !== current.width ||
            original.height !== current.height ||
            original.page !== current.page
          ) {
            // Updated signature - update it
            await updateSignatureInDatabase(current)
          }
        }
      }

      // 3. Update the original signatures to current state
      setOriginalSignatures([...currentSignatures])
      setHasUnsavedChanges(false)

      // Remove success toast

    } catch (error) {
      console.error("Error syncing signatures:", error)
      // Keep error toast for failures
      toast({
        title: "Failed to save changes",
        description: "An error occurred while saving some changes. Please try again.",
        duration: 5000,
        variant: "destructive"
      })
      throw error
    }
  }

  // Validate signature placement for saving (allows placement outside document limits)
  const validateSignaturePlacement = (annotation: Annotation, pageDimensions: { originalWidth: number, originalHeight: number }) => {
    if (annotation.type !== "signature") return { isValid: true, message: "" }

    // Allow signatures to be placed anywhere - no restrictions
    // All signatures are valid regardless of position
    return { isValid: true, message: "" }
  }



  // Handle annotation drag with defensive coordinate validation
  const handleAnnotationDrag = (id: string, newX: number, newY: number, providedPageDimensions?: { width: number; height: number; originalWidth: number; originalHeight: number }) => {
    // Validate coordinates are reasonable numbers
    if (!Number.isFinite(newX) || !Number.isFinite(newY) || newX < -1000 || newY < -1000 || newX > 10000 || newY > 10000) {
      console.warn('Invalid drag coordinates detected, ignoring:', { id, newX, newY })
      return
    }

    // Track that a drag operation is in progress

    setAnnotations(prev => {
      const newAnnotations = prev.map(ann => {
        if (ann.id === id) {
          // Get the page dimensions for proper coordinate conversion
          const pageDimensions = providedPageDimensions || pagesDimensions.get(ann.page)
          if (!pageDimensions) {
            // Only warn once per page to avoid console spam
            if (!(window as any).missingPageDimensions) (window as any).missingPageDimensions = new Set()
            if (!(window as any).missingPageDimensions.has(ann.page)) {
              console.warn(`No page dimensions for page ${ann.page} during drag operation, skipping coordinate update for annotation ${id}. PDF may still be loading.`)
                ; (window as any).missingPageDimensions.add(ann.page)
            }
            return ann // Don't update if we can't calculate properly
          }

          // ENSURE DIMENSIONS: Get from pageDimensions or use reasonable defaults based on page info
          const originalWidth = pageDimensions.originalWidth || pageDimensions.width || 612
          const originalHeight = pageDimensions.originalHeight || pageDimensions.height || 792

          if (originalWidth < 100 || originalHeight < 100) {
            console.warn('Invalid page dimensions detected, skipping drag:', { originalWidth, originalHeight })
            return ann
          }

          // NO BOUNDARIES - users can drag signatures anywhere
          const finalX = newX
          const finalY = newY
          
          // 🎯 CRITICAL FIX: Use display dimensions for rotated pages (drag handler)
          const displayWidth = getDisplayWidth(pageDimensions, originalWidth)
          const displayHeight = getDisplayHeight(pageDimensions, originalHeight)
          
          const relativeX = finalX / displayWidth
          const relativeY = finalY / displayHeight

          // Validate relative coordinates
          if (!Number.isFinite(relativeX) || !Number.isFinite(relativeY)) {
            console.warn('Invalid relative coordinates calculated, skipping drag:', { relativeX, relativeY, finalX, finalY, originalWidth, originalHeight })
            return ann
          }

          // NO BOUNDARY CHECKS - signatures can be placed anywhere

          // Debug position updates (suppressed for cleaner console)
          if (false) { // Set to true only for debugging
            console.log('Position update:', {
              id,
              originalPosition: { x: ann.x, y: ann.y },
              requestedPosition: { x: newX, y: newY },
              actualPosition: { x: finalX, y: finalY },
              relative: { x: relativeX, y: relativeY }
            })
          }

          return {
            ...ann,
            x: finalX,  // Store screen X coordinate
            y: finalY,  // Store screen Y coordinate
            relativeX,
            relativeY,
            // Also update relative width/height to maintain consistency
            relativeWidth: ann.width / originalWidth,
            relativeHeight: ann.height / originalHeight
          }
        }
        return ann
      })

      return newAnnotations
    })

    // Notify parent component of drag changes (moved outside state updater)
    // Create the new annotations array separately for the callback
    let hasValidUpdate = false
    const updatedAnnotations = annotations.map(ann => {
      if (ann.id === id) {
        const pageDimensions = pagesDimensions.get(ann.page)
        if (!pageDimensions) {
          // No page dimensions for callback, skipping drag update (warn suppressed)
          return ann
        }

        const { originalWidth, originalHeight } = pageDimensions

        // NO BOUNDS - allow free positioning
        let boundedX = newX
        let boundedY = newY

        // 🎯 CRITICAL FIX: Use display dimensions for rotated pages (drag handler 2)
        const displayWidth = getDisplayWidth(pageDimensions, originalWidth)
        const displayHeight = getDisplayHeight(pageDimensions, originalHeight)

        const relativeX = boundedX / displayWidth
        const relativeY = boundedY / displayHeight

        // Check if position actually changed
        const positionChanged = ann.x !== boundedX || ann.y !== boundedY
        if (positionChanged) {
          hasValidUpdate = true
        }

        return {
          ...ann,
          x: boundedX,
          y: boundedY,
          relativeX,
          relativeY,
          relativeWidth: ann.width / originalWidth,
          relativeHeight: ann.height / originalHeight
        }
      }
      return ann
    })

    // Only call onSave and setHasUnsavedChanges if there was a valid update
    if (hasValidUpdate) {
      // In assignment mapping mode, always sync with parent component
      console.log('📍 ASSIGNMENT PDF EDITOR: Update annotation - syncing with parent')
      onSave(updatedAnnotations)
      setHasUnsavedChanges(true)
      setHasUserAddedAnnotations(true) // Mark user activity to prevent annotation consolidation
    }
  }

  // Handle annotation resize
  const handleAnnotationResize = (id: string, newWidth: number, newHeight: number) => {
    setAnnotations(prev => {
      const newAnnotations = prev.map(ann => {
        if (ann.id === id) {
          // Get the page dimensions for proper coordinate conversion
          const pageDimensions = pagesDimensions.get(ann.page)
          if (!pageDimensions) {
            console.warn('No page dimensions for resize operation, cannot update size')
            return ann // Don't update if we can't calculate properly
          }

          // CRITICAL: Use original dimensions for bounds and calculations
          // 🎯 CRITICAL FIX: Use corrected dimensions for scanned documents
          const originalWidth = pageDimensions.displayWidth || pageDimensions.originalWidth
          const originalHeight = pageDimensions.displayHeight || pageDimensions.originalHeight

          // Ensure the annotation doesn't exceed page bounds (using original dimensions)
          const maxWidth = originalWidth - ann.x
          const maxHeight = originalHeight - ann.y
          const boundedWidth = Math.max(50, Math.min(newWidth, maxWidth))
          const boundedHeight = Math.max(30, Math.min(newHeight, maxHeight))
          const relativeWidth = boundedWidth / originalWidth
          const relativeHeight = boundedHeight / originalHeight

          return {
            ...ann,
            width: boundedWidth,
            height: boundedHeight,
            relativeWidth,
            relativeHeight,
            // Also update relative position to maintain consistency
            relativeX: ann.x / originalWidth,
            relativeY: ann.y / originalHeight
          }
        }
        return ann
      })

      return newAnnotations
    })

    // CRITICAL: Notify parent component of resize changes (moved outside state updater)
    console.log('🔔 SIGNATURE RESIZE: Notifying parent of size change')
    // Create the new annotations array separately for the callback
    let hasValidUpdate = false
    const updatedAnnotations = annotations.map(ann => {
      if (ann.id === id) {
        const pageDimensions = pagesDimensions.get(ann.page)
        if (!pageDimensions) {
          console.warn(`No page dimensions for callback, skipping resize update for annotation ${id}`)
          return ann
        }

        const { originalWidth, originalHeight } = pageDimensions
        const maxWidth = originalWidth - ann.x
        const maxHeight = originalHeight - ann.y
        const boundedWidth = Math.max(50, Math.min(newWidth, maxWidth))
        const boundedHeight = Math.max(20, Math.min(newHeight, maxHeight))
        const relativeWidth = boundedWidth / originalWidth
        const relativeHeight = boundedHeight / originalHeight

        // Check if size actually changed
        const sizeChanged = ann.width !== boundedWidth || ann.height !== boundedHeight
        if (sizeChanged) {
          hasValidUpdate = true
        }

        return {
          ...ann,
          width: boundedWidth,
          height: boundedHeight,
          relativeWidth,
          relativeHeight,
          relativeX: ann.x / originalWidth,
          relativeY: ann.y / originalHeight
        }
      }
      return ann
    })

    // Only call onSave and setHasUnsavedChanges if there was a valid update
    if (hasValidUpdate) {
      // In assignment mapping mode, always sync with parent component
      console.log('📍 ASSIGNMENT PDF EDITOR: Resize annotation - syncing with parent')
      onSave(updatedAnnotations)
      setHasUnsavedChanges(true)
      setHasUserAddedAnnotations(true) // Mark user activity to prevent annotation consolidation
    } else {
      console.log('🔔 RESIZE: No valid size change detected, skipping save')
    }
  }

  // Handle annotation content change
  const handleAnnotationContentChange = (id: string, content: string) => {
    const newAnnotations = annotations.map((annotation) => (annotation.id === id ? { ...annotation, content } : annotation))
    setAnnotations(newAnnotations)

    // For Fast Sign mode (no token), just update local state
    // Don't call onSave here - signatures should only be saved when user clicks "Update Document"
    setHasUnsavedChanges(true)
  }

  // Handle font size change for text annotations
  const handleFontSizeChange = (id: string, fontSize: number) => {
    const clampedSize = Math.max(8, Math.min(19, fontSize)) // Clamp between 8-19px
    const newAnnotations = annotations.map((annotation) =>
      annotation.id === id ? { ...annotation, fontSize: clampedSize } : annotation
    )
    setAnnotations(newAnnotations)
    setHasUnsavedChanges(true)
  }

  // Handle annotation delete
  const handleAnnotationDelete = (id: string) => {
    const annotationToDelete = annotations.find(a => a.id === id)

    const newAnnotations = annotations.filter((annotation) => annotation.id !== id)
    console.log('🔍 SIGNATURE INDEXING SYSTEM: Signature deleted, remaining signatures with state:', newAnnotations.filter(a => a.type === 'signature').map(s => ({
      id: s.id,
      page: s.page,
      coordinates: { x: s.x, y: s.y, width: s.width, height: s.height },
      relativePosition: { relativeX: s.relativeX, relativeY: s.relativeY, relativeWidth: s.relativeWidth, relativeHeight: s.relativeHeight }
    })))

    // Update local state
    setAnnotations(newAnnotations)
    setSelectedAnnotation(null)
    setHasUnsavedChanges(true)

    // Immediately call onSave to sync with parent component
    if (onSave) {
      // In assignment mapping mode, always sync with parent component
      console.log('📍 ASSIGNMENT PDF EDITOR: Delete annotation - syncing with parent')
      onSave(newAnnotations)
    }
  }

  // Listen for delete annotation events from sidebar
  useEffect(() => {
    const handleDeleteAnnotation = (event: CustomEvent) => {
      const { id } = event.detail
      console.log('🗑️ PDF Editor: Received delete annotation event from sidebar for:', id)
      handleAnnotationDelete(id)
    }

    window.addEventListener('deleteAnnotation', handleDeleteAnnotation as EventListener)

    return () => {
      window.removeEventListener('deleteAnnotation', handleDeleteAnnotation as EventListener)
    }
  }, [handleAnnotationDelete])

  // Handle save
  const handleSaveAnnotations = async () => {
    // Allow saving if there are unsaved changes OR if all annotations were deleted
    if (!hasUnsavedChanges && annotations.length > 0) return

    // Validate all signature placements before saving
    const invalidSignatures: string[] = []
    const validationMessages: string[] = []

    annotations.forEach(annotation => {
      if (annotation.type === "signature") {
        const pageDims = pagesDimensions.get(annotation.page)
        if (pageDims) {
          const validation = validateSignaturePlacement(annotation, {
            originalWidth: pageDims.originalWidth,
            originalHeight: pageDims.originalHeight
          })
          if (!validation.isValid) {
            invalidSignatures.push(annotation.id)
            validationMessages.push(validation.message)
          }
        }
      }
    })

    // If there are invalid signatures, show error and don't save
    if (invalidSignatures.length > 0) {
      toast({
        title: "No se puede guardar el documento",
        description: validationMessages[0] || "Algunas firmas no están posicionadas correctamente. Por favor ajústalas e inténtalo de nuevo.",
        variant: "destructive",
        duration: 8000,
      })

      // Highlight the first invalid signature
      if (invalidSignatures[0]) {
        setSelectedAnnotation(invalidSignatures[0])
        // Document boundaries removed - visual feedback removed
        setDraggingSignatureId(invalidSignatures[0])

        // Auto-hide drag indicator after 5 seconds
        setTimeout(() => {
          // Document boundaries removed
          setDraggingSignatureId(null)
        }, 5000)
      }

      return
    }

    try {
      setSaving(true)
      
      // Handle mapping mode differently
      if (internalMappingMode) {
        // In mapping mode, save signature locations to database
        const mappedSignatures = annotations.filter(ann => ann.type === "signature")
        
        if (mappedSignatures.length === 0) {
          return
        }

        const response = await fetch(`/api/fast-sign/${documentId}/map-signatures`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            signatures: mappedSignatures
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          
          // Handle locked document status (423)
          if (response.status === 423) {
            throw new Error(`El documento ya no puede ser modificado. Estado actual: ${errorData.currentStatus || 'enviado/firmado'}. No se pueden cambiar los mapeos después de enviar el documento para firma.`)
          }
          
          // Handle other errors
          throw new Error(errorData.error || "Failed to save signature mappings")
        }

        setHasUnsavedChanges(false)
        setLastSaved(new Date())
        
        // Show continue button instead of exiting mapping mode immediately
        setShowContinueButton(true)
        // Don't exit mapping mode immediately - let user click continue
        // setInternalMappingMode(false)
        // setCurrentTool("select")
        
        return
      }
      
      // Normal save mode
      await onSave(annotations)
      setHasUnsavedChanges(false)
      setLastSaved(new Date())

      // Show success message for signatures outside document limits
      // NO BOUNDARY VALIDATION - signatures can be placed anywhere

    } catch (error) {
      console.error("Error saving annotations:", error)
      toast({
        title: "Error al guardar",
        description: "No pudimos guardar tus cambios. Por favor inténtalo de nuevo.",
        duration: 5000,
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  // Handle send document
  const handleSendDocument = async () => {
    if (!onSend || hasUnsavedChanges) return

    try {
      setSending(true)
      await onSend(annotations)
      // Remove toast notification - the redirect to completion page is enough feedback
    } catch (error) {
      console.error("Error sending document:", error)
      // Only show error toast
      toast({
        title: "Failed to send",
        description: "We couldn't send your document. Please try again.",
        duration: 5000,
      })
    } finally {
      setSending(false)
    }
  }

  // Handle continue after mapping save
  const handleContinue = () => {
    // Exit mapping mode
    setInternalMappingMode(false)
    setCurrentTool("select")
    setShowContinueButton(false)
    
    // Call the onContinue callback to navigate to next step
    if (onContinue) {
      onContinue()
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#F8F9FB' }}>
      {/* Custom CSS for slow pulse animation and margin guidelines */}
      <style>{`
        @keyframes slowPulse {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.05);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes signaturePulse {
          0% {
            opacity: 0;
            transform: scale(0.9);
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
            box-shadow: 0 0 0 20px rgba(59, 130, 246, 0.3);
          }
          100% {
            opacity: 0;
            transform: scale(1.2);
            box-shadow: 0 0 0 40px rgba(59, 130, 246, 0);
          }
        }
        
        .signature-highlight-pulse {
          position: absolute;
          border: 3px solid #3b82f6;
          background-color: rgba(59, 130, 246, 0.1);
          border-radius: 8px;
          pointer-events: none;
          z-index: 30;
          animation: signaturePulse 2s ease-out;
        }
        
        /* Document boundaries CSS removed - visual boundaries were inaccurate and confusing */
      `}</style>




      {/* Main toolbar */}
      <div
        className="border-b border-border py-1 lg:py-2 px-2 lg:px-6"
        style={{
          backgroundColor: '#FFFFFF' // --topbar
        }}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Left section - Document name (mobile: smaller, desktop: with logo) */}
          <div className="flex items-center space-x-1 lg:space-x- min-w-0 flex-1 lg:flex-none">
            <span className="text-sm lg:text-base font-medium text-foreground truncate max-w-[150px] sm:max-w-[200px] lg:max-w-[300px]">
              {previewMode ? "Template Preview" : documentName}
            </span>
          </div>

          {/* Center section - Page navigation (desktop only) */}
          <div className="hidden lg:flex items-center space-x-6">
            {/* Page Navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-2 rounded-lg text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center bg-background border border-border rounded-lg px-3 py-2">
                <input
                  type="number"
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value)
                    if (page > 0 && page <= numPages) {
                      setCurrentPage(page)
                    }
                  }}
                  className="w-12 text-center text-sm bg-transparent text-foreground focus:outline-none"
                />
                <span className="text-sm text-muted-foreground ml-1">/ {numPages || 1}</span>
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(numPages || 1, p + 1))}
                disabled={currentPage >= (numPages || 1)}
                className="p-2 rounded-lg text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                title="Next Page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center space-x-1 bg-background border border-border rounded-lg p-1">
              <button
                onClick={handleZoomOut}
                disabled={scale <= 0.5}
                className="p-2 rounded-lg text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                title="Zoom Out"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="px-3 py-2 text-sm text-muted-foreground min-w-[4rem] text-center">
                {Math.round(scale * 100)}%
              </div>
              <button
                onClick={handleZoomIn}
                disabled={scale >= 3.0}
                className="p-2 rounded-lg text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                title="Zoom In"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={handleFitWidth}
                className="p-2 rounded-lg text-foreground hover:bg-muted transition-colors"
                title="Fit Width (100%)"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>

            {/* Desktop Actions */}
            <div className="flex items-center space-x-2">


              {/* Add Signature Button - Hidden in preview mode */}
              {!previewMode && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      // Check if Fast Sign mode and if everything is ready
                      if (onPageDimensionsReady && pagesDimensions.size === 0) {
                        toast({
                          title: "Please wait",
                          description: "The document is still loading. Please wait a moment before adding signatures.",
                          duration: 3000,
                        })
                        return
                      }



                      handleToolChange("signature")
                    }}
                    disabled={onPageDimensionsReady && pagesDimensions.size === 0}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${onPageDimensionsReady && pagesDimensions.size === 0
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : currentTool === "signature" || showSignatureModal || showSimpleCanvas
                        ? "bg-primary text-primary-foreground"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                  >
                    <Pen className="h-4 w-4 mr-2" />
                {internalMappingMode ? "Agregar campo" : "Añadir Firma"}
                  </button>

                  {/* Add Text Button - HIDDEN FOR NOW */}
                  {/* <button
                    onClick={() => {
                      console.log('📝 TEXT: Desktop "Añadir Texto" button clicked!')
                      handleToolChange("text")
                    }}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${currentTool === "text"
                        ? "bg-primary text-primary-foreground"
                        : "bg-green-600 text-white hover:bg-green-700"
                      }`}
                  >
                    <Type className="h-4 w-4 mr-2" />
                    Añadir Texto
                  </button> */}


                </div>
              )}


              {!hideSaveButton && !previewMode && (
                <>
                  {!showContinueButton ? (
                    <button
                      onClick={handleSaveAnnotations}
                      disabled={saving || (internalMappingMode ? (annotations || []).filter(a => a.type === "signature").length === 0 : !hasUnsavedChanges)}
                      className="flex items-center px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {internalMappingMode ? "Guardar mapeo" : "Guardar"}
                    </button>
                  ) : (
                    <button
                      onClick={handleContinue}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4 mr-2" />
                      Continuar
                    </button>
                  )}
                </>
              )}
              {onSend && !previewMode && (
                <button
                  onClick={handleSendDocument}
                  disabled={sending || hasUnsavedChanges}
                  className="flex items-center px-4 py-2 bg-success text-success-foreground rounded-lg hover:bg-success/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </button>
              )}

              {/* Settings Dropdown - Desktop */}
              {showMappingToggle && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center justify-center w-10 h-10 text-foreground hover:bg-muted rounded-lg transition-colors"
                    title="Configuración"
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setInternalMappingMode(!internalMappingMode)
                      if (!internalMappingMode) {
                        // Entering mapping mode - switch to signature tool for adding fields
                        setCurrentTool("signature")
                      } else {
                        // Exiting mapping mode
                        setCurrentTool("select")
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {internalMappingMode ? "Salir de Mapeo" : "Indexar Firma"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              )}
            </div>
          </div>

          {/* Right section - Mobile controls */}
          <div className="flex items-center space-x-2">
            {/* Mobile save button - Hidden in preview mode */}
            {!hideSaveButton && !previewMode && (
              <>
                {!showContinueButton ? (
                  <button
                    onClick={handleSaveAnnotations}
                    disabled={saving || (internalMappingMode ? (annotations || []).filter(a => a.type === "signature").length === 0 : !hasUnsavedChanges)}
                    className="lg:hidden flex items-center justify-center w-8 h-8 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                   title={saving ? "Guardando..." : internalMappingMode ? "Guardar mapeo" : "Guardar"}
                  >
                    <Save className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleContinue}
                    className="lg:hidden flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    title="Continuar"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </>
            )}

            {/* Mobile indicators and settings */}
            <div className="lg:hidden flex items-center space-x-2">
              <div className="flex items-center bg-background border border-border rounded-lg px-2 py-1">
                <span className="text-xs text-foreground">{currentPage}/{numPages || 1}</span>
              </div>
              
              {/* Settings Dropdown - Mobile */}
              {showMappingToggle && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center justify-center w-8 h-8 text-foreground hover:bg-muted rounded-lg transition-colors"
                    title="Configuración"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setInternalMappingMode(!internalMappingMode)
                      if (!internalMappingMode) {
                        // Entering mapping mode - switch to signature tool for adding fields
                        setCurrentTool("signature")
                      } else {
                        // Exiting mapping mode
                        setCurrentTool("select")
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {internalMappingMode ? "Salir de Mapeo" : "Indexar Firma"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              )}
            </div>


          </div>
        </div>
      </div>

      {/* Mobile bottom toolbar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border px-4 py-3 safe-area-pb">
        <div className="flex flex-col space-y-2">
          {/* Swipe instruction */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              {previewMode ? `Template Preview - Page ${currentPage}/${numPages || 1}` : `Swipe left/right to navigate pages (${currentPage}/${numPages || 1})`}
            </p>
          </div>



          {/* Main controls */}
          <div className={`flex items-center ${previewMode ? 'justify-center' : 'justify-between'}`}>
            {/* Left - Menu/Sidebar button - Only show on mobile screens */}
            {!previewMode && (
              <button
                onClick={onOpenSidebar}
                className="md:hidden flex items-center justify-center w-12 h-12 bg-white border border-gray-300 text-gray-700 rounded-full shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                title="Menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            {/* Center - Add Signature and Text - Hidden in preview mode */}
            {!previewMode && (
              <div className="flex flex-col items-center space-y-2">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      // Check if Fast Sign mode and if everything is ready
                      if (onPageDimensionsReady && pagesDimensions.size === 0) {
                        toast({
                          title: "Please wait",
                          description: "The document is still loading. Please wait a moment before adding signatures.",
                          duration: 3000,
                        })
                        return
                      }

                      handleToolChange("signature")
                    }}
                    disabled={onPageDimensionsReady && pagesDimensions.size === 0}
                    className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${onPageDimensionsReady && pagesDimensions.size === 0
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : currentTool === "signature" || showSignatureModal || showSimpleCanvas
                        ? "bg-primary text-primary-foreground"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                  >
                    <Pen className="h-5 w-5 mr-2" />
                {internalMappingMode ? "Agregar campo" : "Añadir Firma"}
                  </button>

                  {/* Mobile Add Text Button - HIDDEN FOR NOW */}
                  {/* <button
                    onClick={() => handleToolChange("text")}
                    className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${currentTool === "text"
                        ? "bg-primary text-primary-foreground"
                        : "bg-green-600 text-white hover:bg-green-700"
                      }`}
                  >
                    <Type className="h-5 w-5 mr-2" />
                    Añadir Texto
                  </button> */}
                </div>


              </div>
            )}

            {/* Preview mode - Show only page navigation */}
            {previewMode && (
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-3 rounded-lg text-foreground hover:bg-muted disabled:opacity-50 transition-colors bg-white border border-border"
                  title="Previous Page"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center bg-white border border-border rounded-lg px-4 py-2">
                  <input
                    type="number"
                    value={currentPage}
                    onChange={(e) => {
                      const page = parseInt(e.target.value)
                      if (page > 0 && page <= numPages) {
                        setCurrentPage(page)
                      }
                    }}
                    className="w-12 text-center text-sm bg-transparent text-foreground focus:outline-none"
                  />
                  <span className="text-sm text-muted-foreground ml-1">/ {numPages || 1}</span>
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(numPages || 1, p + 1))}
                  disabled={currentPage >= (numPages || 1)}
                  className="p-3 rounded-lg text-foreground hover:bg-muted disabled:opacity-50 transition-colors bg-white border border-border"
                  title="Next Page"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* Right - Toggle Right Sidebar - Hidden in preview mode */}
            {!previewMode && (
              <button
                onClick={onOpenRightSidebar}
                className="flex items-center justify-center w-12 h-12 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                title="Actions"
              >
                <Edit3 className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Document Viewer */}
      <div
        className="pdf-document-container pb-20 lg:pb-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="pdf-document-wrapper">
          <div
            ref={containerRef}
            className="pdf-document-content pdf-auto-fit"
            style={{
              cursor: currentTool === "signature" ? "crosshair" : "default",
              imageRendering: 'crisp-edges',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale'
            }}
          >
            <Document
              file={documentUrl}
              onLoadSuccess={({ numPages }) => {
                setNumPages(numPages)
                setIsLoading(false)
                setPdfLoadError(null)
            

                // Call PDF ready callback
                if (onPdfReady) {
                  // Small delay to ensure PDF is fully rendered
                  setTimeout(() => {
                    onPdfReady()
                  }, 200)
                }
              }}
              onLoadError={(error) => {
                console.error("PDF load error:", error)
                setPdfLoadError(error)
                setIsLoading(false)
                // Try to recover by setting a fallback page count
                setNumPages(1)
                toast({
                  title: "PDF Loading Error",
                  description: "There was an issue loading the PDF. Some features may be limited.",
                  variant: "destructive"
                })
              }}
              options={PDF_OPTIONS}
              loading={
                <div className="pdf-loading-container">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading PDF document...</p>
                  </div>
                </div>
              }
              error={
                <div className="pdf-error-container bg-gray-50 border-2 border-dashed border-gray-300">
                  <div className="text-center">
                    <div className="text-red-500 text-4xl lg:text-6xl mb-4">⚠️</div>
                    <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-2">PDF Loading Failed</h3>
                    <p className="text-sm lg:text-base text-gray-600 mb-4">
                      Unable to load the PDF document. This might be due to:
                    </p>
                    <ul className="text-xs lg:text-sm text-gray-500 text-left mb-6">
                      <li>• Network connectivity issues</li>
                      <li>• PDF file corruption</li>
                      <li>• Browser compatibility</li>
                      <li>• PDF.js worker not available</li>
                    </ul>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <button
                        onClick={() => {
                          setIsLoading(true)
                          setPdfLoadError(null)
                          window.location.reload()
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Reload Page
                      </button>
                      <button
                        onClick={onBack}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                      >
                        Go Back
                      </button>
                    </div>
                  </div>
                </div>
              }
            >
              {!isLoading && !pdfLoadError && numPages > 0 ? (
                <EnhancedPdfPageWithOverlay
                  pageNumber={currentPage}
                  scale={scale}
                  documentUrl={documentUrl}
                  annotations={annotations.filter(a =>
                    a.page === currentPage
                    // Show all annotations for the current page - filtering happens inside EnhancedPdfPageWithOverlay
                  )}
                  onClick={(e, pageNumber, pageInfo) => {
                    if (pageInfo) {
                      handlePageLoad(pageNumber, pageInfo)
                    }
                    handleContainerClick(e, pageNumber, pageInfo)
                  }}
                  onTouch={(e, pageNumber, pageInfo) => {
                    if (pageInfo) {
                      handlePageLoad(pageNumber, pageInfo)
                    }
                    handleContainerTouch(e, pageNumber, pageInfo)
                  }}
                  onPageLoad={(pageNumber, pageInfo) => {
                    // This is called when the page loads and dimensions are ready

                    handlePageLoad(pageNumber, pageInfo)

                    // Call the page dimensions ready callback
                    if (onPageDimensionsReady) {
                      onPageDimensionsReady()
                    }
                  }}
                >
                  {/* Document Boundaries - REMOVED: Visual boundaries were inaccurate and confusing */}

                  {annotations
                    .filter(a => a.page === currentPage)
                    .map(annotation => (
                      <div key={`${currentPage}-${annotation.id}`} className="pointer-events-auto">
                        <DraggableAnnotation
                          annotation={annotation}
                          isSelected={selectedAnnotation === annotation.id}
                          onSelect={() => {
                            // Only signatures should stay selected - text annotations are just for interaction
                            if (annotation.type === "signature") {
                              setSelectedAnnotation(annotation.id)
                              // Don't change tool if persistent signature mode is active
                              if (!persistentSignatureMode || !pendingSignature) {
                                setCurrentTool("select")
                              }
                            } else if (annotation.type === "text") {
                              // For text annotations, clear any existing selection
                              setSelectedAnnotation(null)
                            }
                          }}
                          onDrag={handleAnnotationDrag}
                          onResize={handleAnnotationResize}
                          onContentChange={handleAnnotationContentChange}
                          onFontSizeChange={handleFontSizeChange}
                          onDelete={handleAnnotationDelete}
                          onDragStart={() => {
                            setIsDraggingAnnotation(true)
                            if (annotation.type === "signature") {
                              // Document boundaries removed - no visual feedback
                              setDraggingSignatureId(annotation.id)
                            }
                          }}
                          onDragEnd={() => {
                            setIsDraggingAnnotation(false)
                            // Document boundaries removed
                            setDraggingSignatureId(null)
                          }}
                          readOnly={readOnly || annotation.readOnly}
                          scale={scale}
                          pageDimensions={pagesDimensions.get(annotation.page)}
                        />
                      </div>
                    ))}

                  {/* Signature Highlight Pulse */}
                  {highlightedSignature && highlightedSignature.page === currentPage && (
                    <div
                      className="signature-highlight-pulse"
                      style={{
                        left: `${highlightedSignature.x * scale}px`,
                        top: `${highlightedSignature.y * scale}px`,
                        width: `${highlightedSignature.width * scale}px`,
                        height: `${highlightedSignature.height * scale}px`,
                      }}
                    />
                  )}
                </EnhancedPdfPageWithOverlay>
              ) : isLoading ? (
                <div className="pdf-loading-container bg-gray-50">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Initializing PDF viewer...</p>
                  </div>
                </div>
              ) : pdfLoadError ? (
                <div className="pdf-error-container bg-red-50 border-2 border-red-200">
                  <div className="text-center">
                    <div className="text-red-500 text-3xl lg:text-4xl mb-4">❌</div>
                    <h3 className="text-base lg:text-lg font-semibold text-red-900 mb-2">PDF Error</h3>
                    <p className="text-red-700 text-xs lg:text-sm mb-4">
                      {pdfLoadError.message || "Failed to load PDF document"}
                    </p>
                    <button
                      onClick={() => {
                        setIsLoading(true)
                        setPdfLoadError(null)
                        window.location.reload()
                      }}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pdf-loading-container bg-gray-50">
                  <div className="text-center">
                    <p className="text-gray-600">No PDF pages available</p>
                  </div>
                </div>
              )}
            </Document>
          </div>
        </div>
      </div>

      {/* Signature Selection Modal */}
      <SignatureSelectionModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onComplete={handleSignatureComplete}
      />

      {/* Simple Signature Canvas for unauthenticated users */}
      <SimpleSignatureCanvas
        isOpen={showSimpleCanvas}
        onClose={() => setShowSimpleCanvas(false)}
        onComplete={handleSimpleCanvasComplete}
      />
    </div>
  )
}

// Draggable annotation component
interface DraggableAnnotationProps {
  annotation: Annotation
  isSelected: boolean
  onSelect: () => void
  onDrag: (id: string, x: number, y: number, pageDimensions?: { width: number; height: number; originalWidth: number; originalHeight: number }) => void
  onResize: (id: string, width: number, height: number) => void
  onContentChange: (id: string, content: string) => void
  onFontSizeChange: (id: string, fontSize: number) => void
  onDelete: (id: string) => void
  onDragStart?: () => void
  onDragEnd?: () => void
  readOnly?: boolean
  scale: number
  pageDimensions?: { width: number; height: number; originalWidth: number; originalHeight: number }
}

function DraggableAnnotation({
  annotation,
  isSelected,
  onSelect,
  onDrag,
  onResize,
  onContentChange,
  onFontSizeChange,
  onDelete,
  onDragStart,
  onDragEnd,
  readOnly = false,
  scale,
  pageDimensions,
}: DraggableAnnotationProps) {


  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 })
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const isInternalUpdateRef = useRef(false) // Track internal updates to prevent loops
  // SIMPLE COORDINATE SYSTEM: Use screen coordinates directly for display
  const [position, setPosition] = useState({ x: annotation.x, y: annotation.y })
  const [size, setSize] = useState({ width: annotation.width, height: annotation.height })

  // Update position and size when annotation changes (but not during internal drag operations)
  useEffect(() => {
    if (!isInternalUpdateRef.current && !isDragging && !isResizing) {
      setPosition({ x: annotation.x, y: annotation.y })
      setSize({ width: annotation.width, height: annotation.height })
    }
  }, [annotation.x, annotation.y, annotation.width, annotation.height, isDragging, isResizing])

  // Click outside to close edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isEditing && textAreaRef.current) {
        const target = event.target as Node
        // Don't close if clicking on textarea or font size controls
        const isClickingTextArea = textAreaRef.current.contains(target)
        const isClickingFontControls = (target as Element).closest?.('.font-size-controls')

        if (!isClickingTextArea && !isClickingFontControls) {
          setIsEditing(false)
        }
      }
    }

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isEditing])

  // Helper to find a properly sized container (retry mechanism)
  const findValidContainer = (element: HTMLElement, maxRetries: number = 5): HTMLElement | null => {
    let currentContainer = element.offsetParent as HTMLElement
    let retries = 0

    while (currentContainer && retries < maxRetries) {
      const rect = currentContainer.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        return currentContainer
      }

      // Try parent container
      currentContainer = currentContainer.offsetParent as HTMLElement || currentContainer.parentElement as HTMLElement
      retries++
    }

    return null
  }

  // Unified handler for mouse and touch start events for dragging
  const handleDragStart = (clientX: number, clientY: number, e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return
    e.stopPropagation()
    onSelect()

    // Validate input coordinates
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      console.warn('Invalid client coordinates for drag start, aborting:', { clientX, clientY })
      return
    }

    // Find a valid container (with proper dimensions)
    const container = findValidContainer(e.target as HTMLElement)
    if (!container) {
      console.warn('No valid container found for drag operation, deferring...')
      // Try again after a short delay to allow PDF to render
      setTimeout(() => {
        const retryContainer = findValidContainer(e.target as HTMLElement)
        if (retryContainer) {
          console.log('Container found on retry, starting drag operation')
          // Start drag operation with the valid container
          isInternalUpdateRef.current = true // Mark as internal update to prevent useEffect loop
          setIsDragging(true)
          onDragStart?.()

          const containerRect = retryContainer.getBoundingClientRect()
          // Store the initial mouse position and annotation position
          setDragStart({ x: clientX, y: clientY })
          setInitialPosition({ x: annotation.x, y: annotation.y })

        } else {
          console.warn('Container still not ready after retry, using absolute positioning fallback')
          isInternalUpdateRef.current = true // Mark as internal update to prevent useEffect loop
          setIsDragging(true)
          onDragStart?.()
          setDragStart({ x: clientX, y: clientY })
          setInitialPosition({ x: annotation.x, y: annotation.y })
        }
      }, 200)
      return
    }

    // Start drag operation now that we have a valid container
    isInternalUpdateRef.current = true // Mark as internal update to prevent useEffect loop
    setIsDragging(true)
    onDragStart?.()

    // Store the initial mouse position and annotation position
    setDragStart({ x: clientX, y: clientY })
    setInitialPosition({ x: annotation.x, y: annotation.y })
  }

  // Unified handler for mouse and touch start events for resizing
  const handleResizeStart = (clientX: number, clientY: number, e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return
    e.stopPropagation()
    onSelect()
    isInternalUpdateRef.current = true // Mark as internal update to prevent useEffect loop
    setIsResizing(true)
    setDragStart({ x: clientX, y: clientY })
  }

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    handleDragStart(e.clientX, e.clientY, e)
  }

  // Handle touch start for dragging
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault() // Prevent default touch behavior
    const touch = e.touches[0]
    if (touch) {
      handleDragStart(touch.clientX, touch.clientY, e)
    }
  }

  // Handle mouse down for resizing
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    handleResizeStart(e.clientX, e.clientY, e)
  }

  // Handle touch start for resizing
  const handleResizeTouchStart = (e: React.TouchEvent) => {
    e.preventDefault() // Prevent default touch behavior
    const touch = e.touches[0]
    if (touch) {
      handleResizeStart(touch.clientX, touch.clientY, e)
    }
  }

  // Handle mouse and touch move/end events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        // Validate mouse coordinates first
        if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY) ||
          !Number.isFinite(dragStart.x) || !Number.isFinite(dragStart.y)) {
          console.warn('Invalid mouse coordinates detected, skipping drag:', { clientX: e.clientX, clientY: e.clientY, dragStart })
          return
        }

        // Get the container element and scale factor
        const annotationElement = document.querySelector(`[data-annotation-id="${annotation.id}"]`) as HTMLElement
        const container = annotationElement ? findValidContainer(annotationElement) : null

        // Get the current PDF scale factor - critical for zoom levels below 100%
        const currentScale = scale || 1.0

        // Calculate mouse movement in screen pixels, then convert to PDF coordinate space
        const screenDeltaX = e.clientX - dragStart.x
        const screenDeltaY = e.clientY - dragStart.y

        // Convert screen movement to PDF coordinate space by dividing by scale
        // When PDF is at 50% zoom, mouse moves 2 screen pixels for every 1 PDF pixel
        const pdfDeltaX = screenDeltaX / currentScale
        const pdfDeltaY = screenDeltaY / currentScale

        // Calculate new position in PDF coordinate space from initial position
        let newX = initialPosition.x + pdfDeltaX
        let newY = initialPosition.y + pdfDeltaY

        // NO BOUNDARIES - free drag anywhere

        // Validate coordinates
        if (!Number.isFinite(newX) || !Number.isFinite(newY)) {
          console.warn('Invalid coordinates calculated, skipping drag:', { newX, newY })
          return
        }

        // Update position and storage using screen coordinates
        setPosition({ x: newX, y: newY })
        onDrag(annotation.id, newX, newY, pageDimensions)

      } else if (isResizing) {
        const dx = e.clientX - dragStart.x
        const dy = e.clientY - dragStart.y
        setSize({
          width: Math.max(50, size.width + dx),
          height: Math.max(20, size.height + dy),
        })
        setDragStart({ x: e.clientX, y: e.clientY })
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault() // Prevent scrolling while dragging
      const touch = e.touches[0]
      if (!touch) return

      if (isDragging) {
        // Validate touch coordinates first
        if (!Number.isFinite(touch.clientX) || !Number.isFinite(touch.clientY) ||
          !Number.isFinite(dragStart.x) || !Number.isFinite(dragStart.y)) {
          console.warn('Invalid touch coordinates detected, skipping drag:', { clientX: touch.clientX, clientY: touch.clientY, dragStart })
          return
        }

        // Get the container element and scale factor
        const annotationElement = document.querySelector(`[data-annotation-id="${annotation.id}"]`) as HTMLElement
        const container = annotationElement ? findValidContainer(annotationElement) : null

        // Get the current PDF scale factor - critical for zoom levels below 100%
        const currentScale = scale || 1.0

        // Calculate touch movement in screen pixels, then convert to PDF coordinate space
        const screenDeltaX = touch.clientX - dragStart.x
        const screenDeltaY = touch.clientY - dragStart.y

        // Convert screen movement to PDF coordinate space by dividing by scale
        const pdfDeltaX = screenDeltaX / currentScale
        const pdfDeltaY = screenDeltaY / currentScale

        // Calculate new position in PDF coordinate space from initial position
        let newX = initialPosition.x + pdfDeltaX
        let newY = initialPosition.y + pdfDeltaY

        // NO BOUNDARIES - free touch drag anywhere

        // Validate coordinates
        if (!Number.isFinite(newX) || !Number.isFinite(newY)) {
          console.warn('Invalid touch coordinates calculated, skipping drag:', { newX, newY })
          return
        }

        // Update position and storage using screen coordinates
        setPosition({ x: newX, y: newY })
        onDrag(annotation.id, newX, newY, pageDimensions)

      } else if (isResizing) {
        const dx = touch.clientX - dragStart.x
        const dy = touch.clientY - dragStart.y
        setSize({
          width: Math.max(50, size.width + dx),
          height: Math.max(20, size.height + dy),
        })
        setDragStart({ x: touch.clientX, y: touch.clientY })
      }
    }

    const handleEnd = () => {
      if (isDragging) {
        // Use the latest local position state captured during drag
        const finalX = position.x
        const finalY = position.y

        // Update the annotation position (this will trigger handleAnnotationDrag)
        onDrag(annotation.id, finalX, finalY, pageDimensions)

        // 2. The onDrag callback will handle setting unsaved changes

        onDragEnd?.() // Notify parent that drag ended
      } else if (isResizing) {
        onResize(annotation.id, size.width, size.height)
        // The onResize callback will handle setting unsaved changes
      }
      setIsDragging(false)
      setIsResizing(false)

      // Clear internal update flag after drag operations complete
      isInternalUpdateRef.current = false
    }

    if (isDragging || isResizing) {
      // Mouse events
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleEnd)

      // Touch events
      document.addEventListener("touchmove", handleTouchMove, { passive: false })
      document.addEventListener("touchend", handleEnd)
      document.addEventListener("touchcancel", handleEnd)
    }

    return () => {
      // Mouse events
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleEnd)

      // Touch events
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleEnd)
      document.removeEventListener("touchcancel", handleEnd)
    }
  }, [isDragging, isResizing, dragStart, position, size, annotation.id, onDrag, onResize])

  return (
    <div
      data-annotation-id={annotation.id}
      className={`absolute border-2 ${
        annotation.readOnly || annotation.isExistingSignature
          ? "border-transparent hover:border-green-400" // Green border only on hover for existing signatures
          : annotation.type === "signature"
            ? "border-transparent hover:border-blue-400"
            : annotation.type === "text"
              ? "border-transparent hover:border-blue-400"
              : isSelected
                ? "border-blue-500"
                : "border-transparent"
        } touch-none ${
          annotation.readOnly || annotation.isExistingSignature
            ? "cursor-default group" // Keep group class for hover effects
            : annotation.type === "signature" 
              ? "cursor-pointer select-none group" 
              : annotation.type === "text" 
                ? "cursor-text group" 
                : ""
        }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        cursor: readOnly ? "default" : (isDragging ? "grabbing" : annotation.type === "signature" ? "pointer" : "grab"),
        zIndex: isSelected ? 30 : 25,
        pointerEvents: "auto",
        // Prevent text selection highlight on signatures
        userSelect: annotation.type === "signature" ? "none" : "auto",
        WebkitUserSelect: annotation.type === "signature" ? "none" : "auto",
        MozUserSelect: annotation.type === "signature" ? "none" : "auto",
      }}
      onMouseDown={annotation.readOnly || annotation.isExistingSignature ? undefined : handleMouseDown}
      onTouchStart={annotation.readOnly || annotation.isExistingSignature ? undefined : handleTouchStart}
      onClick={(e) => {
        e.stopPropagation()
        // Prevent interaction with existing signatures
        if (annotation.readOnly || annotation.isExistingSignature) {
          return
        }
        // Only signatures should be "selected" - text annotations just show hover state
        if (annotation.type === "signature" && !isSelected) {
          onSelect()
        }
        // Text annotations don't need to be "selected" - they just respond to hover and double-click
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        // Prevent interaction with existing signatures
        if (annotation.readOnly || annotation.isExistingSignature) {
          return
        }
        // Enable text editing on double-click for text annotations
        if (annotation.type === "text") {
          setIsEditing(true)
          return
        }
        // Prevent any default double-click behavior on signatures
        if (annotation.type === "signature") {
          return false
        }
      }}
    >
      {annotation.type === "text" ? (
        isEditing ? (
          <div className="relative w-full h-full">
            {/* Font size controls outside on the left */}
            <div className="font-size-controls absolute -left-5 top-0 flex flex-col">
              <button
                className="w-4 h-4 bg-white flex items-center justify-center text-xs hover:bg-gray-50 transition-colors shadow-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onFontSizeChange(annotation.id, (annotation.fontSize || 12) + 1)
                }}
                title="Aumentar tamaño de fuente"
              >
                ▲
              </button>
              <button
                className="w-4 h-4 bg-white flex items-center justify-center text-xs hover:bg-gray-50 transition-colors shadow-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onFontSizeChange(annotation.id, (annotation.fontSize || 12) - 1)
                }}
                title="Reducir tamaño de fuente"
              >
                ▼
              </button>
            </div>
            {/* Elastic text area */}
            <textarea
              ref={textAreaRef}
              className="w-full h-full p-2 resize border-none focus:outline-none focus:ring-0 bg-white text-black text-left overflow-hidden"
              style={{
                fontSize: `${annotation.fontSize || 12}px`,
                minWidth: '100%',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap'
              }}
              value={annotation.content || ""}
              onChange={(e) => {
                onContentChange(annotation.id, e.target.value)
                // Auto-expand width based on content
                const textarea = e.target as HTMLTextAreaElement
                const lines = e.target.value.split('\n')
                const maxLineLength = Math.max(...lines.map(line => line.length))
                const charWidth = (annotation.fontSize || 12) * 0.6 // Approximate character width
                const newWidth = Math.max(120, maxLineLength * charWidth + 20) // Min 120px + padding

                // Update annotation width if content requires more space
                if (newWidth > annotation.width) {
                  onResize(annotation.id, newWidth, annotation.height)
                }
              }}
              placeholder="Escribir texto aquí..."
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  setIsEditing(false)
                }
              }}
              autoFocus
            />
          </div>
        ) : (
          <div
            className="w-full h-full p-2 flex items-center justify-start text-black text-left overflow-hidden"
            style={{
              fontSize: `${annotation.fontSize || 12}px`,
              wordWrap: 'break-word',
              whiteSpace: 'pre-wrap'
            }}
          >
            {annotation.content || "Doble clic para editar"}
          </div>
        )
      ) : annotation.type === "signature" ? (
        <div className="w-full h-full relative">
          {annotation.imageData ? (
            <img
              src={annotation.imageData}
              alt="Signature"
              className="w-full h-full object-contain pointer-events-none"
              draggable={false}
            />
          ) : (
            // Show pulsing blue dot for signature mapping mode
            <div className="w-full h-full flex items-center justify-center relative">
              {/* Pulsing blue dot */}
              <div className="relative">
                {/* Main dot */}
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                </div>
                {/* Pulsing rings */}
                <div className="absolute inset-0 w-8 h-8 bg-blue-400 rounded-full animate-ping opacity-75"></div>
                <div className="absolute inset-0 w-8 h-8 bg-blue-300 rounded-full animate-pulse opacity-50"></div>
              </div>
              {/* Optional label */}
              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-blue-600 font-medium whitespace-nowrap">
                Firma {annotation.content || ""}
              </div>
            </div>
          )}
          
          {/* Tooltip for existing signatures */}
          {(annotation.readOnly || annotation.isExistingSignature) && (
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-green-600 text-white text-xs px-2 py-1 rounded shadow-lg z-40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
              Firmado con FastSign
            </div>
          )}
        </div>
      ) : null}

      {!readOnly && !annotation.readOnly && !annotation.isExistingSignature && (
        <>
          {/* Resize handle - only for signatures */}
          {annotation.type === "signature" && (
            <div
              className="absolute bottom-right w-8 h-8 bg-blue-500 rounded-full cursor-se-resize -right-4 -bottom-4 flex items-center justify-center touch-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              onMouseDown={handleResizeMouseDown}
              onTouchStart={handleResizeTouchStart}
            >
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          )}

          {/* Delete button - for both signatures and text */}
          <button
            className="absolute -top-4 -right-4 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center touch-none shadow-lg transition-all duration-200 z-50 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(annotation.id)
            }}
            title={annotation.type === "signature" ? "Eliminar firma" : "Eliminar texto"}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )
}

