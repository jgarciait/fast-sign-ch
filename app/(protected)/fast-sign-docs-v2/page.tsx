"use client"

import { useRouter } from "next/navigation"
import { lazy, Suspense } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, Loader2 } from "lucide-react"

// Lazy loading del componente principal
const FastSignDocumentManagerV2 = lazy(() => import("@/components/fast-sign-document-manager-v2"))

// Componente de loading optimizado
function LoadingComponent() {
    return (
        <div className="min-h-screen" style={{ backgroundColor: "#F8F9FB" }}>
            <div className="p-8">
                <Card className="w-full">
                    <CardContent className="p-8">
                        <div className="flex flex-col items-center justify-center space-y-4">
                            <div className="flex items-center space-x-2">
                                <FileText className="h-8 w-8 text-blue-500" />
                                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-semibold text-gray-900">Cargando documentos...</h3>
                                <p className="text-sm text-gray-600 mt-1">Preparando la interfaz de gestión...</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default function FastSignDocsV2Page() {
    const router = useRouter()

    const handleClose = () => {
        router.back()
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: "#F8F9FB" }}>
            <div className="p-8">
                <Suspense fallback={<LoadingComponent />}>
                    <FastSignDocumentManagerV2 onClose={handleClose} />
                </Suspense>
            </div>
        </div>
    )
} 
