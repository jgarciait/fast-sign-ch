"use client"
import { useRouter } from "next/navigation"
import SignDocumentViewer from "@/components/sign-document-viewer"

type DocumentViewPageProps = {
  documentUrl: string
  documentName: string
  documentId: string
  token: string
  onBack: () => void
}

export default function DocumentViewPage({
  documentUrl,
  documentName,
  documentId,
  token,
  onBack,
}: DocumentViewPageProps) {
  const router = useRouter()

  const handleSignClick = () => {
    router.push(`/sign/${documentId}/signature?token=${token}`)
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-hidden">
        <SignDocumentViewer
          documentId={documentId}
          documentName={documentName}
          token={token}
          onSign={handleSignClick}
          onBack={onBack}
          showSignButton={true}
          showBackButton={true}
        />
      </div>
    </div>
  )
}
