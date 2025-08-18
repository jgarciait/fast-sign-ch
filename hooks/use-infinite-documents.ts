"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { 
  getFastSignDocumentsByArchiveStatus,
  getDocumentsWithStatus 
} from "@/app/actions/fast-sign-actions"

interface Document {
  id: string
  file_name: string
  file_path: string
  file_size?: number
  file_type?: string
  status: string
  created_at: string
  profiles?: {
    id: string
    email: string
    full_name?: string
  }
  file_records?: any[]
  document_type?: string
  documentStatus?: string
}

interface UseInfiniteDocumentsProps {
  isArchived: boolean
  searchTerm?: string
  dateFilter?: string
  showUserDocs?: boolean
  pageSize?: number
}

export const useInfiniteDocuments = ({
  isArchived,
  searchTerm = "",
  dateFilter = "all",
  showUserDocs = true,
  pageSize = 100
}: UseInfiniteDocumentsProps) => {
  
  const queryKey = [
    'infinite-documents',
    isArchived ? 'archived' : 'active',
    searchTerm,
    showUserDocs,
    pageSize
    // Removed dateFilter from queryKey for now since it's not implemented in API
  ]

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
    gcTime: 1000 * 60 * 10, // 10 minutes (was cacheTime)
    refetchOnWindowFocus: false,
  })

  // Flatten all pages into a single array
  const documents = data?.pages.flatMap(page => page.documents) || []
  const totalCount = data?.pages[0]?.totalCount || 0

  // Performance: Removed debug logging for production

  return {
    documents,
    totalCount,
    error,
    isLoading,
    isError,
    isFetching,
    isFetchingNextPage,
    hasNextPage: !!hasNextPage,
    fetchNextPage,
    refetch
  }
}
