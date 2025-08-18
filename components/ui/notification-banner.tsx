"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface NotificationBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void
  showCloseButton?: boolean
}

export const NotificationBanner = React.forwardRef<HTMLDivElement, NotificationBannerProps>(
  ({ className, children, onClose, showCloseButton = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "fixed top-16 left-1/2 transform -translate-x-1/2 z-50",
          "bg-card/95 backdrop-blur-sm text-card-foreground px-6 py-3 rounded-lg shadow-lg border",
          "animate-bounce-slow",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-2">
          {children}
          {showCloseButton && (
            <button
              onClick={onClose}
              className="ml-2 p-1 hover:bg-muted rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    )
  }
)
NotificationBanner.displayName = "NotificationBanner"

export default NotificationBanner
