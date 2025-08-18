"use client"

import { useState, useEffect } from "react"
import { Shield, ShieldCheck, ShieldX, Settings2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { 
  updateRateLimitSettings,
  getIntegrationStatistics,
  type IntegrationStatistics
} from "@/app/actions/integration-actions"

interface RateLimitConfigProps {
  integration: {
    id: string
    integration_name: string
    rate_limiting_enabled?: boolean
    daily_rate_limit?: number
    monthly_rate_limit?: number
  }
  onUpdate: () => void
}

export default function RateLimitConfig({ integration, onUpdate }: RateLimitConfigProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [rateLimitingEnabled, setRateLimitingEnabled] = useState(integration.rate_limiting_enabled || false)
  const [dailyLimit, setDailyLimit] = useState(integration.daily_rate_limit || 4000)
  const [monthlyLimit, setMonthlyLimit] = useState(integration.monthly_rate_limit || 100000)
  const [statistics, setStatistics] = useState<IntegrationStatistics | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const { toast } = useToast()

  // Load current statistics
  useEffect(() => {
    const loadStatistics = async () => {
      if (!integration.id) return
      
      setStatsLoading(true)
      try {
        const stats = await getIntegrationStatistics(integration.id)
        setStatistics(stats)
      } catch (error) {
        console.error("Error loading statistics:", error)
      } finally {
        setStatsLoading(false)
      }
    }

    loadStatistics()
  }, [integration.id])

  const handleToggleRateLimit = async (enabled: boolean) => {
    setIsLoading(true)
    try {
      await updateRateLimitSettings(integration.integration_name, enabled)
      setRateLimitingEnabled(enabled)
      toast({
        title: "Rate limiting updated",
        description: `Rate limiting has been ${enabled ? 'enabled' : 'disabled'}.`,
      })
      onUpdate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update rate limiting settings.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveLimits = async () => {
    setIsLoading(true)
    try {
      await updateRateLimitSettings(
        integration.integration_name,
        rateLimitingEnabled,
        dailyLimit,
        monthlyLimit
      )
      
      toast({
        title: "Rate limits updated",
        description: "Your rate limit settings have been saved successfully.",
      })
      setIsEditing(false)
      onUpdate()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update rate limit settings.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getDisplayName = () => {
    switch (integration.integration_name) {
      case 'aquarius_software':
        return 'Aquarius Software'
      default:
        return integration.integration_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  const dailyPercentage = statistics && rateLimitingEnabled 
    ? Math.min((statistics.current_daily_usage / dailyLimit) * 100, 100)
    : 0

  const monthlyPercentage = statistics && rateLimitingEnabled 
    ? Math.min(((statistics.current_monthly_usage || 0) / monthlyLimit) * 100, 100)
    : 0

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <div className="w-6 h-6 bg-blue-200 rounded flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div>
            <CardTitle className="text-lg">Rate Limiting</CardTitle>
            <CardDescription>
              Control API usage limits for {getDisplayName()}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={rateLimitingEnabled ? "default" : "secondary"}>
            {rateLimitingEnabled ? "Enabled" : "Disabled"}
          </Badge>
          <Switch
            checked={rateLimitingEnabled}
            onCheckedChange={handleToggleRateLimit}
            disabled={isLoading}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Rate Limiting Status */}
        {rateLimitingEnabled && !statsLoading && statistics && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Current Usage</h3>
            
            {/* Daily Usage */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm">Daily Usage</Label>
                <span className="text-sm text-gray-600">
                  {formatNumber(statistics.current_daily_usage)} / {formatNumber(dailyLimit)}
                </span>
              </div>
              <Progress value={dailyPercentage} className="h-2" />
              <div className="text-xs text-gray-500">
                {dailyPercentage.toFixed(1)}% of daily limit used
              </div>
            </div>

            {/* Monthly Usage */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm">Monthly Usage</Label>
                <span className="text-sm text-gray-600">
                  {formatNumber(statistics.current_monthly_usage || 0)} / {formatNumber(monthlyLimit)}
                </span>
              </div>
              <Progress value={monthlyPercentage} className="h-2" />
              <div className="text-xs text-gray-500">
                {monthlyPercentage.toFixed(1)}% of monthly limit used
              </div>
            </div>
          </div>
        )}

        {/* Configuration */}
        {rateLimitingEnabled && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">Limits Configuration</h3>
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  disabled={isLoading}
                  className="flex items-center space-x-1"
                >
                  <Settings2 className="w-4 h-4" />
                  <span>Configure</span>
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dailyLimit">Daily Limit</Label>
                    <Input
                      id="dailyLimit"
                      type="number"
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(Number(e.target.value))}
                      placeholder="4000"
                      min="1"
                    />
                    <div className="text-xs text-gray-500">Maximum requests per day</div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyLimit">Monthly Limit</Label>
                    <Input
                      id="monthlyLimit"
                      type="number"
                      value={monthlyLimit}
                      onChange={(e) => setMonthlyLimit(Number(e.target.value))}
                      placeholder="100000"
                      min="1"
                    />
                    <div className="text-xs text-gray-500">Maximum requests per month</div>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button onClick={handleSaveLimits} disabled={isLoading}>
                    Save Limits
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsEditing(false)
                      setDailyLimit(integration.daily_rate_limit || 4000)
                      setMonthlyLimit(integration.monthly_rate_limit || 100000)
                    }}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">Daily Limit</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {formatNumber(dailyLimit)}
                  </div>
                  <div className="text-xs text-gray-500">requests per day</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">Monthly Limit</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {formatNumber(monthlyLimit)}
                  </div>
                  <div className="text-xs text-gray-500">requests per month</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Disabled State */}
        {!rateLimitingEnabled && (
          <div className="text-center py-8">
            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Rate Limiting Disabled</h3>
            <p className="text-sm text-gray-600 mb-4">
              No limits are currently applied to API requests for this integration.
            </p>
            <p className="text-xs text-gray-500">
              Enable rate limiting above to set daily and monthly usage limits.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
