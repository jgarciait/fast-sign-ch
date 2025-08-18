"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PdfMergeComponentV2 } from "@/components/pdf-merge-component-v2"

export default function MergePdfPage() {
  const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  const handleMergeComplete = (result: { success: boolean; message: string; documentUrl?: string; documentId?: string }) => {
    setAlert({
      type: result.success ? 'success' : 'error',
      message: result.message
    })
    
    // Clear alert after 5 seconds
    setTimeout(() => setAlert(null), 5000)
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Fusionar PDF</h1>
        <p className="text-gray-600">
          Sube hasta 20 documentos (máx 50MB cada uno) y fusiόnalos en uno solo
        </p>
      </div>

      {alert && (
        <Alert className={`mb-6 ${alert.type === 'error' ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}`}>
          <AlertDescription className={alert.type === 'error' ? 'text-red-700' : 'text-green-700'}>
            {alert.message}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Fusión de Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          <PdfMergeComponentV2 />
        </CardContent>
      </Card>
    </div>
  )
} 