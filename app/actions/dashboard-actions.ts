"use server"

import { createClient } from "@/utils/supabase/server"

export interface DashboardStats {
  totalDocuments: number
  totalFileRecords: number
  totalCustomers: number
  totalSigningRequests: number
  documentsThisMonth: number
  fileRecordsThisMonth: number
  customersThisMonth: number
  signingRequestsThisMonth: number
  documentsByType: Array<{ type: string; count: number }>
  documentsByStatus: Array<{ status: string; count: number }>
  recentActivity: Array<{
    id: string
    type: 'document' | 'file_record' | 'customer' | 'signing_request'
    title: string
    description: string
    created_at: string
  }>
  monthlyDocuments: Array<{ month: string; count: number }>
  integrationUsage: Array<{ integration: string; count: number }>
  documentSizeStats: {
    totalSize: number
    averageSize: number
    largestDocument: number
  }
}

export async function getDashboardStats(): Promise<{ data: DashboardStats | null; error: string | null }> {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { data: null, error: "Usuario no autenticado" }
    }

    // Get current date for monthly calculations
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    // Total counts
    const [
      documentsResult,
      fileRecordsResult,
      customersResult,
      signingRequestsResult
    ] = await Promise.all([
      supabase.from('documents').select('*', { count: 'exact', head: true }).eq('created_by', user.id),
      supabase.from('file_records').select('*', { count: 'exact', head: true }).eq('created_by', user.id),
      supabase.from('customers').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('signing_requests').select('*, documents!inner(*)', { count: 'exact', head: true }).eq('documents.created_by', user.id)
    ])

    // Monthly counts
    const [
      documentsThisMonthResult,
      fileRecordsThisMonthResult,
      customersThisMonthResult,
      signingRequestsThisMonthResult
    ] = await Promise.all([
      supabase.from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .gte('created_at', firstOfMonth.toISOString()),
      supabase.from('file_records')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .gte('created_at', firstOfMonth.toISOString()),
      supabase.from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', firstOfMonth.toISOString()),
      supabase.from('signing_requests')
        .select('*, documents!inner(*)', { count: 'exact', head: true })
        .eq('documents.created_by', user.id)
        .gte('signing_requests.created_at', firstOfMonth.toISOString())
    ])

    // Documents by type
    const { data: documentsByType } = await supabase
      .from('documents')
      .select('document_type')
      .eq('created_by', user.id)

    const typeStats = documentsByType?.reduce((acc: Record<string, number>, doc) => {
      const type = doc.document_type || 'Sin tipo'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})

    // Documents by status
    const { data: documentsByStatus } = await supabase
      .from('documents')
      .select('status')
      .eq('created_by', user.id)

    const statusStats = documentsByStatus?.reduce((acc: Record<string, number>, doc) => {
      const status = doc.status || 'Sin estado'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    // Recent activity - combining different types
    const { data: recentDocuments } = await supabase
      .from('documents')
      .select('id, file_name, created_at, document_type')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    const { data: recentFileRecords } = await supabase
      .from('file_records')
      .select('id, created_at, filing_systems!inner(nombre)')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    const { data: recentCustomers } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    // Monthly documents trend (last 6 months)
    const { data: monthlyDocumentsData } = await supabase
      .from('documents')
      .select('created_at')
      .eq('created_by', user.id)
      .gte('created_at', sixMonthsAgo.toISOString())
      .order('created_at', { ascending: true })

    const monthlyStats = monthlyDocumentsData?.reduce((acc: Record<string, number>, doc) => {
      const month = new Date(doc.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' })
      acc[month] = (acc[month] || 0) + 1
      return acc
    }, {})

    // Integration usage
    const { data: integrationUsageData } = await supabase
      .from('integration_api_usage')
      .select('integration_id, integration_settings(integration_name)')
      .eq('user_id', user.id)

    const integrationStats = integrationUsageData?.reduce((acc: Record<string, number>, usage: any) => {
      const name = usage.integration_settings?.integration_name || 'Desconocido'
      acc[name] = (acc[name] || 0) + 1
      return acc
    }, {})

    // Document size statistics
    const { data: documentSizes } = await supabase
      .from('documents')
      .select('file_size')
      .eq('created_by', user.id)

    const sizes = documentSizes?.map(d => d.file_size || 0) || []
    const totalSize = sizes.reduce((sum, size) => sum + size, 0)
    const averageSize = sizes.length > 0 ? totalSize / sizes.length : 0
    const largestDocument = Math.max(...sizes, 0)

    // Combine recent activity
    const recentActivity = [
      ...(recentDocuments?.map(doc => ({
        id: doc.id,
        type: 'document' as const,
        title: doc.file_name,
        description: `Documento ${doc.document_type || 'sin tipo'} creado`,
        created_at: doc.created_at
      })) || []),
      ...(recentFileRecords?.map((record: any) => ({
        id: record.id,
        type: 'file_record' as const,
        title: `Expediente ${record.filing_systems?.nombre || 'Sin nombre'}`,
        description: 'Nuevo expediente creado',
        created_at: record.created_at
      })) || []),
      ...(recentCustomers?.map(customer => ({
        id: customer.id,
        type: 'customer' as const,
        title: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email,
        description: 'Nuevo contacto agregado',
        created_at: customer.created_at
      })) || [])
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10)

    const dashboardStats: DashboardStats = {
      totalDocuments: documentsResult.count || 0,
      totalFileRecords: fileRecordsResult.count || 0,
      totalCustomers: customersResult.count || 0,
      totalSigningRequests: signingRequestsResult.count || 0,
      documentsThisMonth: documentsThisMonthResult.count || 0,
      fileRecordsThisMonth: fileRecordsThisMonthResult.count || 0,
      customersThisMonth: customersThisMonthResult.count || 0,
      signingRequestsThisMonth: signingRequestsThisMonthResult.count || 0,
      documentsByType: Object.entries(typeStats || {}).map(([type, count]) => ({ type, count })),
      documentsByStatus: Object.entries(statusStats || {}).map(([status, count]) => ({ status, count })),
      recentActivity,
      monthlyDocuments: Object.entries(monthlyStats || {}).map(([month, count]) => ({ month, count })),
      integrationUsage: Object.entries(integrationStats || {}).map(([integration, count]) => ({ integration, count })),
      documentSizeStats: {
        totalSize,
        averageSize,
        largestDocument
      }
    }

    return { data: dashboardStats, error: null }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return { data: null, error: 'Error al obtener estadísticas del dashboard' }
  }
}
