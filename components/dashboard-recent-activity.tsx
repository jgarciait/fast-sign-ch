"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Folder, Users, PenTool } from "lucide-react"

interface ActivityItem {
  id: string
  type: 'document' | 'file_record' | 'customer' | 'signing_request'
  title: string
  description: string
  created_at: string
}

interface DashboardRecentActivityProps {
  activities: ActivityItem[]
}

export default function DashboardRecentActivity({ activities }: DashboardRecentActivityProps) {
  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'document':
        return FileText
      case 'file_record':
        return Folder
      case 'customer':
        return Users
      case 'signing_request':
        return PenTool
      default:
        return FileText
    }
  }

  const getActivityColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'document':
        return 'bg-blue-100 text-blue-800'
      case 'file_record':
        return 'bg-green-100 text-green-800'
      case 'customer':
        return 'bg-purple-100 text-purple-800'
      case 'signing_request':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getActivityLabel = (type: ActivityItem['type']) => {
    switch (type) {
      case 'document':
        return 'Documento'
      case 'file_record':
        return 'Expediente'
      case 'customer':
        return 'Contacto'
      case 'signing_request':
        return 'Firma'
      default:
        return 'Actividad'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) {
      return 'Hace unos minutos'
    } else if (diffInHours < 24) {
      return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`
    } else if (diffInHours < 48) {
      return 'Ayer'
    } else {
      return date.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      })
    }
  }

  // Calculate dynamic height based on content
  const getContentHeight = () => {
    if (activities.length === 0) return 200 // Empty state height
    const itemHeight = 80 // Approximate height per activity item
    const maxItems = 6 // Maximum items to show before scrolling
    const visibleItems = Math.min(activities.length, maxItems)
    return Math.max(300, visibleItems * itemHeight) // Minimum 300px
  }

  const contentHeight = getContentHeight()
  const shouldScroll = activities.length > 6

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          Actividad Reciente
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col" style={{ height: `${contentHeight}px` }}>
        {activities.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay actividad reciente</p>
            </div>
          </div>
        ) : (
          <div className={`flex-1 space-y-3 pr-2 ${shouldScroll ? 'overflow-y-auto' : ''}`}>
            {activities.map((activity) => {
              const Icon = getActivityIcon(activity.type)
              return (
                <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-gray-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.title}
                      </p>
                      <Badge variant="secondary" className={`text-xs ${getActivityColor(activity.type)}`}>
                        {getActivityLabel(activity.type)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(activity.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
