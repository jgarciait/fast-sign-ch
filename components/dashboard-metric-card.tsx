"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LucideIcon } from "lucide-react"

interface DashboardMetricCardProps {
  title: string
  value: number | string
  change?: number
  changeLabel?: string
  icon: LucideIcon
  color?: string
  trend?: 'up' | 'down' | 'neutral'
}

export default function DashboardMetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  color = "#0d2340",
  trend = 'neutral'
}: DashboardMetricCardProps) {
  const formatValue = (val: number | string) => {
    if (typeof val === 'number') {
      return val.toLocaleString()
    }
    return val
  }

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600'
      case 'down':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getTrendBadgeVariant = () => {
    switch (trend) {
      case 'up':
        return 'default'
      case 'down':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  return (
    <Card className="transition-all duration-300 hover:shadow-lg border-l-4" style={{borderLeftColor: color}}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        <Icon className="h-5 w-5" style={{color}} />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold text-gray-900">
            {formatValue(value)}
          </div>
          {change !== undefined && (
            <Badge variant={getTrendBadgeVariant()} className="text-xs">
              {change > 0 ? '+' : ''}{change} {changeLabel}
            </Badge>
          )}
        </div>
        {change !== undefined && (
          <p className={`text-xs mt-1 ${getTrendColor()}`}>
            {trend === 'up' && '↗ '}
            {trend === 'down' && '↘ '}
            {changeLabel || 'este mes'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
