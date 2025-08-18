"use client"

import { useEffect, useState } from "react"
import { FileText, Users, Folder, PenTool, TrendingUp, HardDrive } from "lucide-react"
import DashboardMetricCard from "@/components/dashboard-metric-card"
import DashboardChart from "@/components/dashboard-chart"
import DashboardRecentActivity from "@/components/dashboard-recent-activity"
import { getDashboardStats, type DashboardStats } from "@/app/actions/dashboard-actions"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true)
        const { data, error } = await getDashboardStats()
        
        if (error) {
          setError(error)
        } else {
          setStats(data)
        }
      } catch (err) {
        setError('Error al cargar datos del dashboard')
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Panel de Control</h1>
          <p className="text-gray-600">Resumen de tu actividad y estadísticas</p>
        </div>

        {/* Skeleton for metric cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>

        {/* Skeleton for charts and activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-8">
        <Alert>
          <AlertDescription>No se pudieron cargar los datos del dashboard</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Panel de Control</h1>
        <p className="text-gray-600">Resumen de tu actividad y estadísticas</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardMetricCard
          title="Total Documentos"
          value={stats.totalDocuments}
          change={stats.documentsThisMonth}
          changeLabel="este mes"
          icon={FileText}
          color="#0d2340"
          trend={stats.documentsThisMonth > 0 ? 'up' : 'neutral'}
        />
        
        <DashboardMetricCard
          title="Expedientes"
          value={stats.totalFileRecords}
          change={stats.fileRecordsThisMonth}
          changeLabel="este mes"
          icon={Folder}
          color="#059669"
          trend={stats.fileRecordsThisMonth > 0 ? 'up' : 'neutral'}
        />
        
        <DashboardMetricCard
          title="Contactos"
          value={stats.totalCustomers}
          change={stats.customersThisMonth}
          changeLabel="este mes"
          icon={Users}
          color="#7c3aed"
          trend={stats.customersThisMonth > 0 ? 'up' : 'neutral'}
        />
        
        <DashboardMetricCard
          title="Solicitudes de Firma"
          value={stats.totalSigningRequests}
          change={stats.signingRequestsThisMonth}
          changeLabel="este mes"
          icon={PenTool}
          color="#ea580c"
          trend={stats.signingRequestsThisMonth > 0 ? 'up' : 'neutral'}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashboardMetricCard
          title="Almacenamiento Total"
          value={formatFileSize(stats.documentSizeStats.totalSize)}
          icon={HardDrive}
          color="#6b7280"
        />
        
        <DashboardMetricCard
          title="Tamaño Promedio"
          value={formatFileSize(stats.documentSizeStats.averageSize)}
          icon={TrendingUp}
          color="#0891b2"
        />
        
        <DashboardMetricCard
          title="Documento Más Grande"
          value={formatFileSize(stats.documentSizeStats.largestDocument)}
          icon={FileText}
          color="#dc2626"
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Monthly Documents Trend */}
          <DashboardChart
            title="Documentos por Mes"
            data={stats.monthlyDocuments.map(item => ({ name: item.month, value: item.count }))}
            type="line"
            color="#0d2340"
            adaptiveHeight={true}
          />

          {/* Documents by Type and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DashboardChart
              title="Documentos por Tipo"
              data={stats.documentsByType.map(item => ({ name: item.type, value: item.count }))}
              type="pie"
              adaptiveHeight={true}
            />
            
            <DashboardChart
              title="Documentos por Estado"
              data={stats.documentsByStatus.map(item => ({ name: item.status, value: item.count }))}
              type="bar"
              color="#059669"
              adaptiveHeight={true}
            />
          </div>

          {/* Integration Usage */}
          {stats.integrationUsage.length > 0 && (
            <DashboardChart
              title="Uso de Integraciones"
              data={stats.integrationUsage.map(item => ({ name: item.integration, value: item.count }))}
              type="bar"
              color="#7c3aed"
              adaptiveHeight={true}
            />
          )}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <DashboardRecentActivity activities={stats.recentActivity} />
        </div>
      </div>
    </div>
  )
}
