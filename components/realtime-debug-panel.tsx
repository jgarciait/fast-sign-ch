'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import useDocumentRealtime from '@/hooks/use-document-realtime'

interface RealtimeEvent {
  id: string
  timestamp: Date
  type: 'document_update' | 'category_update' | 'category_delete'
  data: any
}

interface RealtimeDebugPanelProps {
  fileRecordId: string
  enabled?: boolean
}

export default function RealtimeDebugPanel({ fileRecordId, enabled = true }: RealtimeDebugPanelProps) {
  const [events, setEvents] = useState<RealtimeEvent[]>([])
  const [isVisible, setIsVisible] = useState(false)

  // Handle realtime events and log them
  const handleDocumentUpdate = (document: any) => {
    console.log('🎯 DEBUG: Document update captured:', document)
    const event: RealtimeEvent = {
      id: `doc-${Date.now()}`,
      timestamp: new Date(),
      type: 'document_update',
      data: document
    }
    setEvents(prev => [event, ...prev.slice(0, 49)]) // Keep last 50 events
  }

  const handleCategoryUpdate = (category: any) => {
    console.log('🎯 DEBUG: Category update captured:', category)
    const event: RealtimeEvent = {
      id: `cat-${Date.now()}`,
      timestamp: new Date(),
      type: 'category_update',
      data: category
    }
    setEvents(prev => [event, ...prev.slice(0, 49)])
  }

  const handleCategoryDelete = (categoryId: string) => {
    console.log('🎯 DEBUG: Category delete captured:', categoryId)
    const event: RealtimeEvent = {
      id: `del-${Date.now()}`,
      timestamp: new Date(),
      type: 'category_delete',
      data: { categoryId }
    }
    setEvents(prev => [event, ...prev.slice(0, 49)])
  }

  // Initialize realtime hook
  const { cleanup } = useDocumentRealtime({
    fileRecordId,
    componentId: 'debug', // Unique ID to prevent channel conflicts
    onDocumentUpdate: handleDocumentUpdate,
    onCategoryUpdate: handleCategoryUpdate,
    onCategoryDelete: handleCategoryDelete,
    enabled: enabled && isVisible
  })

  // Test function to trigger a fake update
  const testRealtimeConnection = () => {
    console.log('🧪 Testing realtime connection...')
    handleDocumentUpdate({
      id: 'test-document',
      file_name: 'Test Document.pdf',
      category_id: null,
      updated_at: new Date().toISOString()
    })
  }

  const clearEvents = () => {
    setEvents([])
  }

  const getEventTypeColor = (type: RealtimeEvent['type']) => {
    switch (type) {
      case 'document_update': return 'bg-blue-100 text-blue-800'
      case 'category_update': return 'bg-green-100 text-green-800'  
      case 'category_delete': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatEventData = (event: RealtimeEvent) => {
    switch (event.type) {
      case 'document_update':
        return `📄 ${event.data.file_name} → Category: ${event.data.category_id || 'uncategorized'}`
      case 'category_update':
        return `🏷️ ${event.data.name} (${event.data.color})`
      case 'category_delete':
        return `🗑️ Category ID: ${event.data.categoryId}`
      default:
        return JSON.stringify(event.data)
    }
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
          className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
        >
          🔧 Debug Realtime
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96 overflow-hidden">
      <Card className="border-purple-200 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-purple-700">
              🔧 Realtime Debug Panel
            </CardTitle>
            <div className="flex gap-1">
              <Badge variant={enabled ? 'default' : 'secondary'} className="text-xs">
                {enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Button
                onClick={() => setIsVisible(false)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
              >
                ×
              </Button>
            </div>
          </div>
          <div className="text-xs text-gray-600">
            Case File: {fileRecordId.slice(0, 8)}...
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-600">
              Events: {events.length}
            </div>
            <div className="flex gap-1">
              <Button
                onClick={testRealtimeConnection}
                variant="outline"
                size="sm"
                className="h-6 text-xs px-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              >
                Test
              </Button>
              <Button
                onClick={clearEvents}
                variant="outline"
                size="sm"
                className="h-6 text-xs px-2"
              >
                Clear
              </Button>
            </div>
          </div>
          
          <Separator className="mb-2" />
          
          <div className="max-h-64 overflow-y-auto space-y-1">
            {events.length === 0 ? (
              <div className="text-xs text-gray-500 italic py-4 text-center">
                No realtime events captured yet.<br />
                Try changing a document category in another tab.
              </div>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="text-xs border rounded p-2 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge 
                      className={`text-xs px-1 py-0 ${getEventTypeColor(event.type)}`}
                    >
                      {event.type.replace('_', ' ')}
                    </Badge>
                    <span className="text-gray-500">
                      {event.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-gray-700">
                    {formatEventData(event)}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}