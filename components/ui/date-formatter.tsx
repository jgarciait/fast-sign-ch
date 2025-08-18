"use client"

import { useEffect, useState } from "react"
import { formatDateClient, formatDistanceToNowClient } from "@/lib/utils"

interface DateFormatterProps {
  date: string | Date
  format?: string
  className?: string
}

export function DateFormatter({ date, format = "PPP 'a las' p", className }: DateFormatterProps) {
  const [formattedDate, setFormattedDate] = useState<string>("")
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    setFormattedDate(formatDateClient(date, format))
  }, [date, format])

  if (!isClient) {
    // Return a placeholder during SSR to avoid hydration mismatch
    return <span className={className}>Loading...</span>
  }

  return <span className={className}>{formattedDate}</span>
}

interface RelativeDateFormatterProps {
  date: string | Date
  addSuffix?: boolean
  className?: string
}

export function RelativeDateFormatter({ date, addSuffix = true, className }: RelativeDateFormatterProps) {
  const [formattedDate, setFormattedDate] = useState<string>("")
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    setFormattedDate(formatDistanceToNowClient(date, { addSuffix }))
  }, [date, addSuffix])

  if (!isClient) {
    // Return a placeholder during SSR to avoid hydration mismatch
    return <span className={className}>hace un momento</span>
  }

  return <span className={className}>{formattedDate}</span>
} 