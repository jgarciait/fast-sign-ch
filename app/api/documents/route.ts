import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { BUCKET_PUBLIC } from '@/utils/supabase/storage'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const mappingId = searchParams.get('mappingId')
    const documentId = searchParams.get('documentId')
    const availableOnly = searchParams.get('availableOnly') === 'true'
    const userOnly = searchParams.get('userOnly') === 'true'
    const search = searchParams.get('search')
    const limit = searchParams.get('limit')
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Request processed

    if (mappingId) {
      // Get document ID from mapping ID (keep user-specific for this case)
      const { data: mapping, error: mappingError } = await supabase
        .from('document_signature_mappings')
        .select('document_id')
        .eq('id', mappingId)
        .eq('created_by', user.id)
        .single()

      if (mappingError || !mapping) {
        return NextResponse.json({ error: 'Mapping not found' }, { status: 404 })
      }

      return NextResponse.json({ documentId: mapping.document_id })
    }

    if (documentId) {
      // Get specific document by ID (GLOBAL ACCESS: any authenticated user can access any document)
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select(`
          id,
          file_name,
          file_path,
          created_at,
          status,
          created_by
        `)
        .eq('id', documentId)
        .single()

      if (docError || !document) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }

      // Get creator information separately
      const { data: creator } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', document.created_by)
        .single()

      const publicUrl = supabase.storage
        .from('public-documents')
        .getPublicUrl(document.file_path).data.publicUrl
      
      const documentWithUrl = {
        id: document.id,
        file_name: document.file_name,
        file_url: publicUrl,
        created_at: document.created_at,
        status: document.status || 'draft',
        created_by: document.created_by,
        creator: {
          full_name: creator?.full_name || 'Usuario',
          email: creator?.email || ''
        }
      }

      return NextResponse.json({ documents: [documentWithUrl] })
    }

    // GLOBAL ACCESS: Get all documents for all users (not just current user)
    // But filter by user if userOnly parameter is true
    let documentsQuery = supabase
      .from('documents')
      .select(`
        id,
        file_name,
        file_path,
        created_at,
        status,
        created_by,
        document_type
      `)
      .eq('archived', false)

    // If availableOnly is true, show documents available for sending to sign
    if (availableOnly) {
      // Allow ALL document types for email sending (email, fast_sign, etc.)
      // Only exclude archived documents (already filtered above)
      // This allows sending previously signed documents with protected signatures
    }

    // Filter by current user if userOnly is true (APPLY AFTER availableOnly to ensure it's not overridden)
    if (userOnly) {
      documentsQuery = documentsQuery.eq('created_by', user.id)
    }
      
      // Get documents that have signatures (should be excluded)
      const { data: documentsWithSignatures, error: signaturesError } = await supabase
        .from('document_signatures')
        .select('document_id')
        .neq('document_id', null)

      // Get documents that are signed or in signing process (should be excluded)
      const { data: signingRequests, error: requestsError } = await supabase
        .from('signing_requests')
        .select('document_id')
        .in('status', ['sent', 'signed', 'returned'])

      // Also exclude documents with completed or signed status
      const { data: completedDocs, error: completedError } = await supabase
        .from('documents')
        .select('id')
        .in('status', ['completed', 'signed'])

      // Get all documents that are used as templates (should be excluded)
      const { data: allTemplates, error: templatesError } = await supabase
        .from('signature_mapping_templates')
        .select('document_mapping_id')
        .eq('is_active', true)

      if (templatesError) {
        console.error('Error fetching templates for availableOnly filter:', templatesError)
      }

      // Collect all document IDs to exclude
      const excludeIds = new Set<string>()

      // Exclude documents with signatures
      if (documentsWithSignatures && !signaturesError) {
        documentsWithSignatures.forEach((item: any) => {
          if (item.document_id) excludeIds.add(item.document_id)
        })
        console.log('Excluding documents with signatures:', documentsWithSignatures.length)
      }

      // Exclude documents that are signed or being signed
      if (signingRequests && !requestsError) {
        signingRequests.forEach((item: any) => {
          if (item.document_id) excludeIds.add(item.document_id)
        })
        console.log('Excluding documents with signing requests:', signingRequests.length)
      }

      // Exclude documents with completed or signed status
      if (completedDocs && !completedError) {
        completedDocs.forEach((item: any) => {
          if (item.id) excludeIds.add(item.id)
        })
        console.log('Excluding completed/signed documents:', completedDocs.length)
      }

      // Exclude documents used as templates
      const templateMappingIds = (allTemplates || []).map(t => t.document_mapping_id).filter(Boolean)
      
      if (templateMappingIds.length > 0) {
        try {
          const { data: templateMappings, error: mappingsError } = await supabase
            .from('document_signature_mappings')
            .select('document_id')
            .in('id', templateMappingIds)

          if (mappingsError) {
            console.error('Error fetching template mappings:', mappingsError)
          } else if (templateMappings) {
            templateMappings.forEach((item: any) => {
              if (item.document_id) excludeIds.add(item.document_id)
            })
            console.log('Excluding templated documents:', templateMappings.length)
          }
        } catch (error) {
          console.error('Exception in template mappings query:', error)
          // Continue without excluding template documents
        }
      }

    // Add search filter if provided
    if (search) {
      documentsQuery = documentsQuery.ilike('file_name', `%${search}%`)
    }

    // Add limit if provided
    if (limit) {
      documentsQuery = documentsQuery.limit(parseInt(limit))
    }

    // Get documents
    const { data: documents, error } = await documentsQuery.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching documents:', error)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    // Validate userOnly filter is working correctly
    if (userOnly && documents && documents.length > 0) {
      const wrongUserDocs = documents.filter(d => d.created_by !== user.id)
      if (wrongUserDocs.length > 0) {
        console.error('❌ CRITICAL BUG: userOnly=true but found documents from other users:', {
          expected_user: user.id,
          wrong_docs_count: wrongUserDocs.length
        })
      }
    }

    // Get creator information for each document (using same logic as fast-sign-actions)
    const creatorIds = [...new Set(documents?.map(doc => doc.created_by).filter(Boolean))]
    
    // Get creator information
    
    let profiles = []
    let profilesError = null
    
    try {
      const result = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', creatorIds)
      
      profiles = result.data || []
      profilesError = result.error
    } catch (error) {
      console.error('Exception fetching profiles:', error)
      profilesError = error
    }
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      // Don't fail the entire request, just continue without creator info
    }
    
    // Process creator profiles

    // Create a map of creator information (same as fast-sign-actions)
    const profilesMap = new Map()
    if (profiles) {
      profiles.forEach(profile => {
        profilesMap.set(profile.id, {
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          full_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unknown User'
        })
      })
    }

    // Get mapping information for documents (to show mapping status)
    const documentIds = documents?.map(doc => doc.id) || []
    let mappingsMap = new Map()
    
    if (documentIds.length > 0) {
      try {
        const { data: mappings, error: mappingsError } = await supabase
          .from('document_signature_mappings')
          .select('id, document_id, signature_fields, created_at, is_template')
          .in('document_id', documentIds)
        
        if (mappingsError) {
          console.error('Error fetching mappings:', mappingsError)
          // Continue without mapping info
        } else if (mappings) {
          mappings.forEach(mapping => {
            mappingsMap.set(mapping.document_id, mapping)
          })
        }
      } catch (error) {
        console.error('Exception fetching mappings:', error)
        // Continue without mapping info
      }
    }

    // Transform documents and generate public URLs
    const documentsWithUrls = (documents || []).map(doc => {
      const publicUrl = supabase.storage
        .from('public-documents')
        .getPublicUrl(doc.file_path).data.publicUrl
      
      // Get creator info from the profilesMap (same as fast-sign-actions)
      const creator = profilesMap.get(doc.created_by)
      const mapping = mappingsMap.get(doc.id)
      
      // Map creator info
      
      return {
        id: doc.id,
        file_name: doc.file_name,
        file_url: publicUrl,
        created_at: doc.created_at,
        status: doc.status || 'draft',
        created_by: doc.created_by,
        creator: {
          full_name: creator?.full_name || 'Usuario',
          email: creator?.email || ''
        },
        // Add mapping status information
        mapping: mapping ? {
          id: mapping.id,
          hasMappings: true,
          signatureFieldsCount: Array.isArray(mapping.signature_fields) ? mapping.signature_fields.length : 0,
          mappedAt: mapping.created_at,
          isTemplate: mapping.is_template || false
        } : {
          hasMappings: false,
          signatureFieldsCount: 0,
          isTemplate: false
        }
      }
    })

    return NextResponse.json({ documents: documentsWithUrls })
  } catch (error) {
    console.error('Error in GET /api/documents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')
    
    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Deleting document:', documentId, 'for user:', user.id)

    // Check if document exists (global access - any user can delete any document)
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('id, file_path, created_by')
      .eq('id', documentId)
      .single()

    if (fetchError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Delete related records first (in correct order due to foreign key constraints)
    
    // 1. Delete signing requests
    const { error: signingRequestsError } = await supabase
      .from('signing_requests')
      .delete()
      .eq('document_id', documentId)

    if (signingRequestsError) {
      console.error('Error deleting signing requests:', signingRequestsError)
      // Continue with deletion process
    }

    // 2. Delete document signature mappings
    const { error: mappingsError } = await supabase
      .from('document_signature_mappings')
      .delete()
      .eq('document_id', documentId)

    if (mappingsError) {
      console.error('Error deleting document signature mappings:', mappingsError)
      // Continue with deletion process
    }

    // 3. Delete document annotations
    const { error: annotationsError } = await supabase
      .from('document_annotations')
      .delete()
      .eq('document_id', documentId)

    if (annotationsError) {
      console.error('Error deleting document annotations:', annotationsError)
      // Continue with deletion process
    }

    // 4. Delete any signatures related to this document (if they exist in a signatures table)
    const { error: signaturesError } = await supabase
      .from('signatures')
      .delete()
      .eq('document_id', documentId)

    if (signaturesError) {
      console.error('Error deleting signatures:', signaturesError)
      // Continue with deletion process - this table might not exist
    }

    // 5. Delete the file from storage
    if (document.file_path) {
      const { error: storageError } = await supabase.storage
        .from('public-documents')
        .remove([document.file_path])

      if (storageError) {
        console.error('Error deleting file from storage:', storageError)
        // Continue with deletion process - storage error shouldn't block database cleanup
      }
    }

    // 6. Finally, delete the document record
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)

    if (deleteError) {
      console.error('Error deleting document from database:', deleteError)
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
    }

    console.log('Document deleted successfully:', documentId)
    return NextResponse.json({ success: true, message: 'Documento eliminado exitosamente' })

  } catch (error) {
    console.error('Error in DELETE /api/documents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
