import { useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

interface Document {
  id: string
  file_name: string
  file_path: string
  category_id?: string
  categoryName?: string
  categoryColor?: string
  categoryIcon?: string
  isUncategorized?: boolean
  created_at: string
  updated_at: string
}

interface DocumentCategory {
  id: string
  name: string
  color: string
  icon: string
}

interface UseDocumentRealtimeProps {
  fileRecordId: string
  componentId?: string // Unique identifier to prevent channel conflicts
  onDocumentUpdate?: (document: Document) => void
  onCategoryUpdate?: (category: DocumentCategory) => void
  onCategoryDelete?: (categoryId: string) => void
  enabled?: boolean
}

export function useDocumentRealtime({
  fileRecordId,
  componentId = 'default',
  onDocumentUpdate,
  onCategoryUpdate,
  onCategoryDelete,
  enabled = true
}: UseDocumentRealtimeProps) {
  const supabase = useMemo(() => createClient(), [])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const categoriesChannelRef = useRef<RealtimeChannel | null>(null)
  
  // Store callbacks in refs to avoid dependency changes
  const onDocumentUpdateRef = useRef(onDocumentUpdate)
  const onCategoryUpdateRef = useRef(onCategoryUpdate)
  const onCategoryDeleteRef = useRef(onCategoryDelete)
  
  // Update refs when callbacks change
  useEffect(() => {
    onDocumentUpdateRef.current = onDocumentUpdate
  }, [onDocumentUpdate])
  
  useEffect(() => {
    onCategoryUpdateRef.current = onCategoryUpdate
  }, [onCategoryUpdate])
  
  useEffect(() => {
    onCategoryDeleteRef.current = onCategoryDelete
  }, [onCategoryDelete])

  // Cleanup function with stable reference
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      console.log('🔌 Unsubscribing from documents realtime channel')
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (categoriesChannelRef.current) {
      console.log('🔌 Unsubscribing from categories realtime channel')
      supabase.removeChannel(categoriesChannelRef.current)
      categoriesChannelRef.current = null
    }
  }, [supabase])

  useEffect(() => {
    if (!enabled || !fileRecordId) {
      cleanup()
      return
    }

    console.log('🚀 Setting up realtime subscriptions for case file:', fileRecordId)
    const documentsChannelName = `documents-${componentId}-${fileRecordId}`
    const categoriesChannelName = `categories-${componentId}-${fileRecordId}`
    
    console.log('📊 Subscription details:', {
      enabled,
      fileRecordId,
      componentId,
      documentsChannelName,
      categoriesChannelName,
      documentFilter: `file_record_id=eq.${fileRecordId}`,
      categoryFilter: `file_record_id=eq.${fileRecordId}`
    })

    // Subscribe to document changes
    const documentsChannel = supabase
      .channel(documentsChannelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `file_record_id=eq.${fileRecordId}`
        },
        (payload) => {
          console.log('📄 Document update received:', payload)
          console.log('📄 Payload details:', {
            old: payload.old,
            new: payload.new,
            eventType: payload.eventType,
            fileRecordId: payload.new?.file_record_id
          })
          
          if (payload.new && onDocumentUpdateRef.current) {
            // Transform the payload to match our Document interface
            const updatedDocument: Document = {
              id: payload.new.id,
              file_name: payload.new.file_name,
              file_path: payload.new.file_path,
              category_id: payload.new.category_id,
              created_at: payload.new.created_at,
              updated_at: payload.new.updated_at,
              // These will be enriched by the component
              categoryName: undefined,
              categoryColor: undefined,
              categoryIcon: undefined,
              isUncategorized: !payload.new.category_id
            }
            
            console.log('📄 Calling onDocumentUpdate with:', updatedDocument)
            onDocumentUpdateRef.current(updatedDocument)
          }
        }
      )
      .subscribe((status) => {
        console.log('📄 Documents realtime status:', status)
      })

        // Subscribe to category changes
    const categoriesChannel = supabase
      .channel(categoriesChannelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'document_categories',
          filter: `file_record_id=eq.${fileRecordId}`
        },
        (payload) => {
          console.log('🏷️ Category update received:', payload)
          console.log('🏷️ Category payload details:', {
            old: payload.old,
            new: payload.new,
            eventType: payload.eventType
          })
          
          if (payload.new && onCategoryUpdateRef.current) {
            const updatedCategory: DocumentCategory = {
              id: payload.new.id,
              name: payload.new.name,
              color: payload.new.color,
              icon: payload.new.icon
            }
            
            console.log('🏷️ Calling onCategoryUpdate with:', updatedCategory)
            onCategoryUpdateRef.current(updatedCategory)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'document_categories',
          filter: `file_record_id=eq.${fileRecordId}`
        },
        (payload) => {
          console.log('🗑️ Category delete received:', payload)
          console.log('🗑️ Category delete payload details:', {
            old: payload.old,
            eventType: payload.eventType
          })
          
          if (payload.old && onCategoryDeleteRef.current) {
            console.log('🗑️ Calling onCategoryDelete with:', payload.old.id)
            onCategoryDeleteRef.current(payload.old.id)
          }
        }
      )
      .subscribe((status) => {
        console.log('🏷️ Categories realtime status:', status)
      })

    channelRef.current = documentsChannel
    categoriesChannelRef.current = categoriesChannel

    // Cleanup on unmount
    return cleanup
  }, [enabled, fileRecordId, supabase, cleanup])

  // Return cleanup function for manual cleanup if needed
  return { cleanup }
}

export default useDocumentRealtime