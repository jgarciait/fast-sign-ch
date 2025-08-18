"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import { 
  getFastSignDocumentsByArchiveStatus,
} from "@/app/actions/fast-sign-actions"

interface Document {
  id: string
  file_name: string
  file_path: string
  file_size?: number
  file_type?: string
  status: string
  created_at: string
  creator?: {
    first_name?: string
    last_name?: string
    email: string
    full_name?: string
  }
  file_records?: any[]
  document_type?: string
  documentStatus?: string
}

interface UseVirtualizedDocumentsProps {
  isArchived: boolean
  searchTerm?: string
  dateFilter?: string
  showUserDocs?: boolean
  pageSize?: number
  virtualStart?: number
  virtualEnd?: number
}

interface VirtualizedDocument {
  index: number
  document?: Document
  isLoading?: boolean
}

export const useVirtualizedDocuments = ({
  isArchived,
  searchTerm = "",
  dateFilter = "all",
  showUserDocs = true,
  pageSize = 100,
  virtualStart = 0,
  virtualEnd = 10
}: UseVirtualizedDocumentsProps) => {
  
  const queryKey = [
    'virtualized-documents',
    isArchived ? 'archived' : 'active',
    searchTerm,
    showUserDocs,
    pageSize
  ]

  // Calculate which pages we need for the visible range
  const startPage = Math.floor(virtualStart / pageSize) + 1
  const endPage = Math.floor(virtualEnd / pageSize) + 1
  const neededPages = useMemo(() => {
    const pages = []
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }
    return pages
  }, [startPage, endPage])

  const fetchDocuments = useCallback(
    async ({ pageParam = 1 }: { pageParam: number }) => {
      try {
        const result = await getFastSignDocumentsByArchiveStatus(
          isArchived,
          searchTerm,
          pageParam,
          pageSize,
          showUserDocs
        )

        if (result.error) {
          throw new Error(result.error)
        }

        const documents = result.documents || []
        const totalCount = result.totalCount || 0
        const hasMore = documents.length === pageSize && (pageParam * pageSize) < totalCount

        return {
          documents,
          totalCount,
          currentPage: pageParam,
          hasMore,
          nextPage: hasMore ? pageParam + 1 : undefined
        }
      } catch (error) {
        throw error
      }
    },
    [isArchived, pageSize, searchTerm, showUserDocs]
  )

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch
  } = useInfiniteQuery({
    queryKey,
    queryFn: fetchDocuments,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
    // Only fetch pages we actually need
    enabled: neededPages.length > 0,
  })

  // Get the total count from the first page
  const totalCount = data?.pages[0]?.totalCount || 0

  // Create a sparse array for virtualized documents
  const virtualizedDocuments = useMemo(() => {
    const docs: VirtualizedDocument[] = []
    
    // Initialize array with the total count
    for (let i = 0; i < totalCount; i++) {
      docs[i] = { index: i }
    }

    // Fill in loaded documents
    data?.pages.forEach(page => {
      const startIndex = (page.currentPage - 1) * pageSize
      page.documents.forEach((doc, idx) => {
        const globalIndex = startIndex + idx
        if (globalIndex < totalCount) {
          docs[globalIndex] = {
            index: globalIndex,
            document: doc
          }
        }
      })
    })

    // Mark loading items for visible range
    for (let i = virtualStart; i <= Math.min(virtualEnd, totalCount - 1); i++) {
      if (!docs[i]?.document) {
        docs[i] = {
          index: i,
          isLoading: true
        }
      }
    }

    return docs
  }, [data, totalCount, pageSize, virtualStart, virtualEnd])

  // Preemptively fetch pages for visible range
  const preemptivelyFetchPages = useCallback(() => {
    neededPages.forEach(pageNum => {
      const pageExists = data?.pages.some(p => p.currentPage === pageNum)
      if (!pageExists && !isFetching) {
        // This triggers fetching of the needed page
        if (pageNum <= (data?.pages[0]?.totalCount || 0) / pageSize + 1) {
          fetchNextPage()
        }
      }
    })
  }, [neededPages, data, isFetching, fetchNextPage, pageSize])

  return {
    virtualizedDocuments,
    totalCount,
    error,
    isLoading,
    isError,
    isFetching,
    isFetchingNextPage,
    hasNextPage: !!hasNextPage,
    fetchNextPage,
    refetch,
    preemptivelyFetchPages
  }
}
