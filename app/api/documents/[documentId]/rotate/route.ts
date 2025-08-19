import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { PDFDocument, degrees } from 'pdf-lib'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const { rotation } = await request.json()

    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })
    }

    // Validate rotation
    if (![90, 180, 270, -90].includes(rotation)) {
      return NextResponse.json({ error: 'Rotación inválida' }, { status: 400 })
    }

    // Get document from database
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    // Check if user has permission to rotate this document
    if (document.created_by !== user.id) {
      return NextResponse.json({ error: 'No tienes permisos para rotar este documento' }, { status: 403 })
    }

    // Download the current PDF from storage
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('public_documents')
      .download(document.file_path)

    if (downloadError || !pdfData) {
      return NextResponse.json({ error: 'Error al descargar el documento' }, { status: 500 })
    }

    // Load and rotate the PDF
    const pdfBytes = await pdfData.arrayBuffer()
    const pdfDoc = await PDFDocument.load(pdfBytes)
    
    // Get all pages and rotate them
    const pages = pdfDoc.getPages()
    pages.forEach(page => {
      // Get current rotation and add new rotation
      const currentRotation = page.getRotation().angle
      const newRotation = (currentRotation + rotation) % 360
      page.setRotation(degrees(newRotation))
    })
    
    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save()
    
    // Update the existing file in storage
    const { error: uploadError } = await supabase.storage
      .from('public_documents')
      .update(document.file_path, modifiedPdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      return NextResponse.json({ error: 'Error al actualizar el documento' }, { status: 500 })
    }

    // Update the rotation in the database
    const currentDbRotation = document.rotation || 0
    const newDbRotation = (currentDbRotation + rotation) % 360
    
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        rotation: newDbRotation,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)

    if (updateError) {
      return NextResponse.json({ error: 'Error al actualizar la base de datos' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Documento rotado ${rotation}° correctamente`,
      rotation: newDbRotation
    })

  } catch (error) {
    console.error('Error rotating document:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
} 