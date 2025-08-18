import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Client-side date formatting utilities to handle timezone issues
export function formatDateClient(dateString: string | Date, formatString: string = "PPP 'a las' p"): string {
  if (typeof window === 'undefined') {
    // Server-side: return a placeholder or basic format
    return new Date(dateString).toLocaleDateString()
  }
  
  // Client-side: format with user's timezone
  return format(new Date(dateString), formatString)
}

export function formatDistanceToNowClient(dateString: string | Date, options?: { addSuffix?: boolean }): string {
  if (typeof window === 'undefined') {
    // Server-side: return a placeholder
    return "hace un momento"
  }
  
  // Client-side: format with user's timezone
  return formatDistanceToNow(new Date(dateString), options)
}

export function generateRandomCode(length: number): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  const charactersLength = characters.length
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}
