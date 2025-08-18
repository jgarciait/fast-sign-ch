"use client"

import { useState } from "react"
import { Copy, Eye, EyeOff, Maximize2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

interface JsonViewerProps {
  data: any
  title?: string
  statusCode?: number
}

export default function JsonViewer({ data, title = "Response", statusCode }: JsonViewerProps) {
  const [showRaw, setShowRaw] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    // Initialize with auto-expanded paths for first 2 levels
    const initialExpanded = new Set<string>()
    const autoExpand = (obj: any, path: string = "", depth: number = 0) => {
      if (depth < 2 && obj && typeof obj === 'object') {
        initialExpanded.add(path)
        if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            autoExpand(item, path ? `${path}.${index}` : `${index}`, depth + 1)
          })
        } else {
          Object.keys(obj).forEach(key => {
            autoExpand(obj[key], path ? `${path}.${key}` : key, depth + 1)
          })
        }
      }
    }
    autoExpand(data)
    return initialExpanded
  })
  const { toast } = useToast()

  const jsonString = JSON.stringify(data, null, 2)
  const sizeInBytes = new Blob([jsonString]).size
  const sizeFormatted = formatBytes(sizeInBytes)
  const propertyCount = data && typeof data === 'object' ? Object.keys(data).length : 0

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonString)
    toast({
      title: "Copied to clipboard",
      description: "JSON response has been copied to your clipboard.",
    })
  }

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedNodes(newExpanded)
  }

  const renderTreeValue = (value: any, key?: string, depth: number = 0, path: string = ""): React.ReactElement => {
    const currentPath = path ? `${path}.${key}` : key || ""
    const isExpanded = expandedNodes.has(currentPath)

    if (value === null) {
      return (
        <div className="flex items-center">
          {key && <span className="text-blue-600 mr-2">"{key}":</span>}
          <span className="text-gray-500">null</span>
        </div>
      )
    }

    if (typeof value === 'boolean') {
      return (
        <div className="flex items-center">
          {key && <span className="text-blue-600 mr-2">"{key}":</span>}
          <span className="text-purple-600">{value.toString()}</span>
        </div>
      )
    }

    if (typeof value === 'number') {
      return (
        <div className="flex items-center">
          {key && <span className="text-blue-600 mr-2">"{key}":</span>}
          <span className="text-blue-600">{value}</span>
        </div>
      )
    }

    if (typeof value === 'string') {
      return (
        <div className="flex items-center">
          {key && <span className="text-blue-600 mr-2">"{key}":</span>}
          <span className="text-green-600">"{value}"</span>
        </div>
      )
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return (
          <div className="flex items-center">
            {key && <span className="text-blue-600 mr-2">"{key}":</span>}
            <span className="text-gray-500">[]</span>
          </div>
        )
      }

      return (
        <div>
          <div className="flex items-center cursor-pointer" onClick={() => toggleExpanded(currentPath)}>
            {isExpanded ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
            {key && <span className="text-blue-600 mr-2">"{key}":</span>}
            <span className="text-gray-700">[{value.length} items]</span>
          </div>
          {isExpanded && (
            <div className="ml-6 mt-1">
              {value.map((item, index) => (
                <div key={index} className="mb-1">
                  {renderTreeValue(item, index.toString(), depth + 1, currentPath)}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value)
      if (keys.length === 0) {
        return (
          <div className="flex items-center">
            {key && <span className="text-blue-600 mr-2">"{key}":</span>}
            <span className="text-gray-500">{"{}"}</span>
          </div>
        )
      }

      return (
        <div>
          <div className="flex items-center cursor-pointer" onClick={() => toggleExpanded(currentPath)}>
            {isExpanded ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
            {key && <span className="text-blue-600 mr-2">"{key}":</span>}
            <span className="text-gray-700">{`{${keys.length} ${keys.length === 1 ? 'property' : 'properties'}}`}</span>
          </div>
          {isExpanded && (
            <div className="ml-6 mt-1">
              {keys.map((objKey, index) => (
                <div key={objKey} className="mb-1">
                  {renderTreeValue(value[objKey], objKey, depth + 1, currentPath)}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    return <span className="text-gray-500">{String(value)}</span>
  }

  if (!data) {
    return (
      <div className="text-sm text-gray-500 italic">
        No response data available
      </div>
    )
  }

  return (
    <div className="border rounded-lg bg-gray-50 w-full">
      <div className="flex items-center justify-between p-3 border-b bg-gray-100 rounded-t-lg">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">{title}</span>
          {statusCode && (
            <span className={`text-xs px-2 py-1 rounded ${
              statusCode >= 200 && statusCode < 300 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {statusCode}
            </span>
          )}
          <span className="text-xs text-gray-500">
            ({propertyCount} {propertyCount === 1 ? 'property' : 'properties'}) • {sizeFormatted}
          </span>
          {sizeInBytes > 50000 && (
            <div className="flex items-center space-x-1 text-xs text-blue-600">
              <AlertTriangle className="w-3 h-3" />
              <span>Large</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="h-6 px-2 text-xs"
          >
            <Maximize2 className="w-3 h-3 mr-1" />
            Expand
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            className="h-6 px-2 text-xs"
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy
          </Button>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center space-x-2">
              <span>{title} - Full View</span>
              {statusCode && (
                <span className={`text-xs px-2 py-1 rounded ${
                  statusCode >= 200 && statusCode < 300 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {statusCode}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Complete JSON response ({sizeFormatted})
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="mb-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRaw(!showRaw)}
                >
                  {showRaw ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                  {showRaw ? 'Tree View' : 'Raw JSON'}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy All
              </Button>
            </div>
            <div className="flex-1 min-h-0 border rounded-lg bg-white overflow-hidden">
              <div className="h-full overflow-auto p-4 font-mono text-sm">
                {showRaw ? (
                  <pre className="text-gray-800 whitespace-pre-wrap">
                    {jsonString}
                  </pre>
                ) : (
                  <div className="text-gray-800">
                    {renderTreeValue(data)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
