"use client"

import type React from "react"

import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/components/logo"

interface DirectSignatureProps {
  documentUrl: string
  documentName: string
  onBack: () => void
  onComplete: (signatureData: SignatureData) => void
}

export type SignatureData = {
  name: string
  date: string
  signatureType: "typed" | "drawn" | "uploaded"
  signatureValue: string
}

export default function DirectSignature({ documentUrl, documentName, onBack, onComplete }: DirectSignatureProps) {
  const [name, setName] = useState("")
  const [signatureType, setSignatureType] = useState<"typed" | "drawn" | "uploaded">("typed")
  const [typedSignature, setTypedSignature] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = "Name is required"
    if (signatureType === "typed" && !typedSignature.trim()) newErrors.signature = "Signature is required"

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)

    // Create signature data
    const signatureData: SignatureData = {
      name,
      date: new Date().toISOString(),
      signatureType,
      signatureValue: typedSignature,
    }

    // Complete the signature process
    onComplete(signatureData)
  }

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm z-10">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center">
            <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-100" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Logo className="h-8 w-8" color="#0d2340" />
            <span className="ml-2 font-semibold">AQSign</span>
            <span className="ml-4 text-gray-500 truncate max-w-md">{documentName}</span>
          </div>
        </div>
      </div>

      {/* Signature form */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-6">Sign Document</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                  errors.name ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Enter your full name"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Signature Type</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="signatureType"
                    checked={signatureType === "typed"}
                    onChange={() => setSignatureType("typed")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Type your signature</span>
                </label>
              </div>
            </div>

            {signatureType === "typed" && (
              <div>
                <label htmlFor="typedSignature" className="block text-sm font-medium text-gray-700 mb-1">
                  Signature
                </label>
                <div className="border border-gray-300 rounded-md p-4 bg-gray-50">
                  <input
                    type="text"
                    id="typedSignature"
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    className={`w-full px-4 py-2 border-0 bg-transparent focus:ring-0 font-signature text-xl ${
                      errors.signature ? "text-red-500" : "text-blue-600"
                    }`}
                    placeholder="Type your signature"
                  />
                </div>
                {errors.signature && <p className="mt-1 text-sm text-red-600">{errors.signature}</p>}
              </div>
            )}

            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={onBack}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0d2340] hover:bg-[#1a3a5f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isSubmitting ? "Signing..." : "Sign Document"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
