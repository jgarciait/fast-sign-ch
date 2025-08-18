"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import FastSignClient from "./fast-sign-client"

export default function FastSignPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    // Redirigir URLs antiguas con view=manage a la nueva ruta
    const view = searchParams.get("view")
    if (view === "manage") {
      router.replace("/fast-sign-docs")
      return
    }
  }, [searchParams, router])

  return <FastSignClient />
}
