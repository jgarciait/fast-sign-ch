import { NextRequest, NextResponse } from 'next/server'
import { createClient } from "@/utils/supabase/server"

export async function POST(request: NextRequest) {
  try {
    console.log('Save temp document API endpoint called')
    
    const body = await request.json()
    const { tempDocumentId, finalFileName } = body
    
    if (!tempDocumentId || !finalFileName) {
      return NextResponse.json(
        { success: false, error: 'Missing tempDocumentId or finalFileName' },
        { status: 400 }
      )
    }

    console.log('Moving temp document to permanent location:', {
      tempDocumentId,
      finalFileName
    })

    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no autenticado' },
        { status: 401 }
      )
    }

    // Get the temporary document record
    const { data: tempDoc, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', tempDocumentId)
      .single()

    if (fetchError || !tempDoc) {
      console.error('Error fetching temp document:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Documento temporal no encontrado' },
        { status: 404 }
      )
    }

    // Move file within storage (no re-upload needed)
    const finalPath = tempDoc.file_path.replace(/temp-/, '')
    
    console.log('Moving file in storage:', {
      from: tempDoc.file_path,
      to: finalPath
    })

    // Move the file within Supabase storage
    const { error: moveError } = await supabase.storage
      .from('public-documents')
      .move(tempDoc.file_path, finalPath)

    if (moveError) {
      console.error('Error moving file in storage:', moveError)
      return NextResponse.json(
        { success: false, error: 'Error al mover archivo en storage' },
        { status: 500 }
      )
    }

    // Update the document record to make it permanent
    const { data: updatedDoc, error: updateError } = await supabase
      .from('documents')
      .update({
        file_name: finalFileName,
        file_path: finalPath,
        archived: false
      })
      .eq('id', tempDocumentId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating document:', updateError)
      return NextResponse.json(
        { success: false, error: 'Error al actualizar documento' },
        { status: 500 }
      )
    }

    console.log('Document moved to permanent location successfully:', {
      documentId: updatedDoc.id,
      finalPath: updatedDoc.file_path
    })

    // Generate the public URL for the document
    const { data: urlData } = supabase.storage
      .from('public-documents')
      .getPublicUrl(updatedDoc.file_path)

    return NextResponse.json({
      success: true,
      message: 'Documento guardado exitosamente',
      documentId: updatedDoc.id,
      documentUrl: urlData.publicUrl
    })

  } catch (error) {
    console.error('Save temp document API error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Save temp document API is running. Use POST to move temp documents.' },
    { status: 200 }
  )
} 