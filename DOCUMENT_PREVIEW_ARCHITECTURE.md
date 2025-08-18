# 📋 ARQUITECTURA COMPLETA DEL PREVIEW DE DOCUMENTOS

## 🎯 Información General

Este documento detalla la arquitectura completa del sistema de preview de documentos en `/fast-sign-docs` cuando el usuario hace click en el botón del **ojito** para ver el documento.

---

## 📚 Librerías y Versiones

### Dependencias Principales

```json
{
  "react-pdf": "9.2.1",
  "pdfjs-dist": "3.11.174", 
  "pdf-lib": "latest",
  "@react-pdf-viewer/core": "latest",
  "@react-pdf-viewer/default-layout": "latest",
  "@react-pdf-viewer/thumbnail": "3.12.0",
  "@react-pdf-viewer/toolbar": "3.12.0"
}
```

### Dependencias de Soporte

```json
{
  "@radix-ui/react-dialog": "latest",
  "lucide-react": "^0.454.0",
  "next": "15.2.4",
  "react": "^19",
  "react-dom": "^19"
}
```

---

## 🏗️ Arquitectura de Componentes

### Componente Principal: `DocumentViewerModal`

**Archivo**: `components/document-viewer-modal.tsx`

```javascript
interface DocumentViewerModalProps {
  isOpen: boolean
  onClose: () => void
  documentId: string
  documentName: string
  token?: string
  requestId?: string
}

export default function DocumentViewerModal({
  isOpen,
  onClose,
  documentId,
  documentName,
  token,
  requestId
}: DocumentViewerModalProps)
```

### Activación desde Fast Sign Manager

**Archivo**: `components/fast-sign-document-manager.tsx`

```javascript
const handleView = (documentId: string, documentName: string) => {
  setDocumentViewerModal({
    isOpen: true,
    documentId,
    documentName
  })
}

// Modal con lazy loading para optimización
<Suspense fallback={<div>Cargando...</div>}>
  <DocumentViewerModal
    isOpen={documentViewerModal.isOpen}
    onClose={closeDocumentViewer}
    documentId={documentViewerModal.documentId}
    documentName={documentViewerModal.documentName}
  />
</Suspense>
```

---

## ⚙️ Configuración de PDF.js

### Configuración Principal

```javascript
// PDF.js options - desde document-viewer-modal.tsx
const PDF_OPTIONS = useMemo(() => ({
  cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/',
  workerSrc: typeof window !== 'undefined' 
    ? `${window.location.origin}/pdf.worker.min.js` 
    : '/pdf.worker.min.js'
}), [])
```

### Workers de PDF.js

**Ubicación**: `/public/`

- `pdf.worker.min.js` - Worker principal
- `pdf.worker.mjs` - Worker moderno (ES modules)  
- `pdf.worker.js` - Worker legacy

### Configuración Automática con Fallback

**Archivo**: `utils/pdf-config.ts`

```javascript
export async function configurePdfJsWithFallback(pageCount?: number): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    const pdfLib = await loadPdfjs()
    
    if (pdfLib && pdfLib.GlobalWorkerOptions) {
      if (!pdfLib.GlobalWorkerOptions.workerSrc) {
        // 1. Intenta .mjs worker (moderno)
        const mjsWorkerSrc = `${window.location.origin}/pdf.worker.mjs`
        
        try {
          const mjsResponse = await fetch(mjsWorkerSrc, { method: 'HEAD' })
          if (mjsResponse.ok) {
            pdfLib.GlobalWorkerOptions.workerSrc = mjsWorkerSrc
            return
          }
        } catch (error) {
          console.warn('MJS worker not available, trying fallback')
        }
        
        // 2. Fallback a .min.js worker
        const minWorkerSrc = `${window.location.origin}/pdf.worker.min.js`
        pdfLib.GlobalWorkerOptions.workerSrc = minWorkerSrc
      }
    }
  } catch (error) {
    console.error('Failed to configure PDF.js:', error)
  }
}
```

---

## 🗄️ Supabase Storage y URLs

### Configuración del Bucket

**Archivo**: `utils/supabase/storage.ts`

```javascript
// Buckets definidos
export const BUCKET_PUBLIC = "public-documents"
export const BUCKET_PRIVATE = "documents"

// Función para generar URL pública
export async function getPublicUrl(path: string) {
  const supabase = createClient()
  const { data } = supabase.storage.from(BUCKET_PUBLIC).getPublicUrl(path)
  return data.publicUrl
}
```

### Estructura de la Base de Datos

```sql
-- Tabla documents
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,  -- Ruta en Supabase Storage
  created_at TIMESTAMP,
  status TEXT
);
```

---

## 🔄 Flujo de Carga de Documentos

### 1. Determinación del Tipo de Documento

**Archivo**: `components/document-viewer-modal.tsx` (líneas 550+)

```javascript
const checkDocumentTypeAndSetUrl = async () => {
  try {
    // Verificación paralela de documento y firmas
    const [docResponse, signatureResponse] = await Promise.allSettled([
      fetch(`/api/pdf/${documentId}`, { method: 'HEAD' }),
      fetch(`/api/documents/${documentId}/signatures/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: Buffer.from("fast-sign-docs@view-all").toString("base64"),
          includeData: false,
        }),
      })
    ])
    
    const docExists = docResponse.status === 'fulfilled' && docResponse.value.ok
    
    if (signatureResponse.status === 'fulfilled' && signatureResponse.value.ok) {
      const signatureData = await signatureResponse.value.json()
      
      if (signatureData.hasSignatures) {
        // Documento CON firmas - usar endpoint con firmas integradas
        setDocumentUrl(`/api/fast-sign/${documentId}/print`)
        setHasSignatures(true)
        setIsUsingMergedPdf(true)
        return
      }
    }
    
    if (docExists) {
      // Documento SIN firmas - usar PDF original
      setDocumentUrl(`/api/pdf/${documentId}`)
      setHasSignatures(false)
      setIsUsingMergedPdf(false)
    } else {
      // Fallback - intentar fast-sign endpoint
      const fastSignResponse = await fetch(`/api/fast-sign/${documentId}/print`, { method: 'HEAD' })
      if (fastSignResponse.ok) {
        setDocumentUrl(`/api/fast-sign/${documentId}/print`)
        setHasSignatures(true)
        setIsUsingMergedPdf(true)
      } else {
        setError("Documento no encontrado")
      }
    }
  } catch (error) {
    setError("Error al cargar el documento")
  }
}
```

### 2. Endpoints Utilizados

| Tipo de Documento | Endpoint | Descripción |
|---|---|---|
| **Con firmas** | `/api/fast-sign/${documentId}/print` | PDF con firmas integradas |
| **Sin firmas** | `/api/pdf/${documentId}` | PDF original |
| **Documentos firmados** | `/api/documents/${documentId}/print?token=...&requestId=...` | PDF firmado con token |

---

## 📡 Proxy de PDF (Anti-CORS)

### Endpoint Principal

**Archivo**: `app/api/pdf/[id]/route.ts`

```javascript
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { documentId } = await params
    const supabase = createAdminClient()
    
    // 1. Obtener información del documento desde la base de datos
    const { data: document, error } = await supabase
      .from("documents")
      .select("file_path, file_name")
      .eq("id", documentId)
      .single()

    if (error || !document) {
      return new NextResponse(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      })
    }

    // 2. Generar URL pública del bucket de Supabase
    const { data: urlData } = supabase.storage
      .from(BUCKET_PUBLIC)
      .getPublicUrl(document.file_path)

    // 3. Hacer fetch del archivo y servirlo directamente (evita CORS)
    const fileResponse = await fetch(urlData.publicUrl, {
      signal: AbortSignal.timeout(30000) // 30 segundos timeout
    })
    
    if (!fileResponse.ok) {
      return new NextResponse(JSON.stringify({ 
        error: "File not found in storage",
        url: urlData.publicUrl
      }), { status: 404 })
    }

    const fileBuffer = await fileResponse.arrayBuffer()

    // 4. Retornar PDF con headers correctos
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600", // Cache 1 hora
        "Content-Disposition": `inline; filename="${document.file_name}"`,
      },
    })

  } catch (error) {
    return new NextResponse(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
}
```

---

## 🎨 Dynamic Imports (Optimización)

### Lazy Loading de Componentes PDF

```javascript
// document-viewer-modal.tsx - Solo carga en el cliente
const Document = dynamic(() => import("react-pdf").then(mod => mod.Document), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )
})

const Page = dynamic(() => import("react-pdf").then(mod => mod.Page), { 
  ssr: false
})
```

### Configuración PDF.js Solo en Cliente

```javascript
const configurePdfJs = () => {
  if (typeof window !== 'undefined') {
    import('react-pdf').then(({ pdfjs }) => {
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`
        console.log('PDF.js worker configured:', pdfjs.GlobalWorkerOptions.workerSrc)
      }
    }).catch((error) => {
      console.warn('Failed to configure PDF.js worker:', error)
    })
  }
}
```

---

## 🔧 Renderizado del PDF

### Componente Document con Configuración

```javascript
<Document
  key={documentUrl} // Force re-render cuando cambia URL
  file={documentUrl}
  onLoadSuccess={onDocumentLoadSuccess}
  onLoadError={onDocumentLoadError}
  options={PDF_OPTIONS}
  loading={<PDFLoadingSkeleton />}
>
  <PDFPageWithSignatures
    pageNumber={pageNumber}
    scale={scale}
    signatures={signatures}
    showOverlays={!isUsingMergedPdf}
    onPageLoad={(pageNumber, width, height) => {
      // Handle page load success
    }}
  />
</Document>
```

### Manejo de Estados

```javascript
const [numPages, setNumPages] = useState<number>(0)
const [pageNumber, setPageNumber] = useState<number>(1)
const [scale, setScale] = useState<number>(1.0)
const [isLoading, setIsLoading] = useState<boolean>(true)
const [documentUrl, setDocumentUrl] = useState<string>("")
const [error, setError] = useState<string>("")
const [hasSignatures, setHasSignatures] = useState<boolean>(false)
const [signatures, setSignatures] = useState<SignatureAnnotation[]>([])
```

---

## 📁 Estructura de Archivos

```
📂 Proyecto
├── 📂 app/
│   ├── 📂 (protected)/
│   │   └── 📂 fast-sign-docs/
│   │       ├── page.tsx                    # Página principal
│   │       └── loading.tsx                 # Loading component
│   └── 📂 api/
│       ├── 📂 pdf/
│       │   └── 📂 [id]/
│       │       └── route.ts               # Proxy PDF (anti-CORS)
│       └── 📂 fast-sign/
│           └── 📂 [documentId]/
│               └── 📂 print/
│                   └── route.ts           # PDF con firmas
├── 📂 components/
│   ├── document-viewer-modal.tsx          # Modal principal ⭐
│   ├── fast-sign-document-manager.tsx     # Lista con botón ojito
│   └── 📂 ui/
│       └── dialog.tsx                     # Dialog base
├── 📂 utils/
│   ├── pdf-config.ts                      # Configuración PDF.js
│   ├── pdf-singleton.ts                   # Singleton loader
│   └── 📂 supabase/
│       ├── storage.ts                     # Configuración buckets
│       └── admin.ts                       # Cliente admin
└── 📂 public/
    ├── pdf.worker.min.js                  # Worker principal ⭐
    ├── pdf.worker.mjs                     # Worker moderno
    └── pdf.worker.js                      # Worker legacy
```

---

## 🚀 Flujo Completo de Ejecución

### 1. Inicialización
```
Usuario → Click ojito → handleView() → DocumentViewerModal se abre
```

### 2. Determinación de Tipo
```
Modal abierto → checkDocumentTypeAndSetUrl() → Parallel requests:
├── HEAD /api/pdf/${documentId}
└── POST /api/documents/${documentId}/signatures/check
```

### 3. Selección de Endpoint
```
Resultado → Selección de URL:
├── Con firmas: /api/fast-sign/${documentId}/print
├── Sin firmas: /api/pdf/${documentId}
└── Fallback: fast-sign endpoint
```

### 4. Configuración PDF.js
```
URL determinada → configurePdfJs() → Worker setup:
├── Intenta: pdf.worker.mjs (moderno)
├── Fallback: pdf.worker.min.js
└── Último: CDN worker
```

### 5. Renderizado
```
PDF.js configurado → <Document> render → <Page> render → PDF visible
```

---

## 🔍 Debugging y Logs

### Logs Principales

```javascript
// document-viewer-modal.tsx
console.log(`DocumentViewerModal: Starting to load document ${documentId}`)
console.log(`DocumentViewerModal: Parallel requests completed in ${time}ms`)
console.log('Document has signatures - using fast-sign print endpoint')
console.log('Document has no signatures - using regular PDF endpoint')

// app/api/pdf/[id]/route.ts  
console.log(`PDF Proxy: Fetching document with ID: ${documentId}`)
console.log(`PDF Proxy: Generated public URL: ${urlData.publicUrl}`)
console.log(`PDF Proxy: PDF file size: ${pdfBytes.byteLength} bytes`)

// utils/pdf-config.ts
console.log('PDF.js worker configured:', pdfjs.GlobalWorkerOptions.workerSrc)
```

### Errores Comunes

| Error | Causa | Solución |
|---|---|---|
| `Transport destroyed` | Worker PDF.js mal configurado | Verificar workers en `/public/` |
| `Document not found` | ID incorrecto o documento eliminado | Verificar ID en base de datos |
| `CORS error` | URL directa sin proxy | Usar endpoint `/api/pdf/` |
| `Worker not found` | Worker files faltantes | Copiar workers a `/public/` |

---

## 📊 Performance y Optimizaciones

### Lazy Loading
- **Componentes PDF**: Solo cargan cuando se necesitan
- **Modal**: Suspense wrapper con fallback
- **Workers**: Configuración diferida hasta primer uso

### Caching
- **PDF Proxy**: Cache de 1 hora (`max-age=3600`)
- **Workers**: Cached por browser automáticamente
- **Supabase URLs**: Generated on-demand

### Memory Management
- **Component unmount**: Reset estados al cerrar modal
- **Worker cleanup**: Previene memory leaks
- **Error boundaries**: Captura errores PDF.js

---

## 🔧 Configuración de Desarrollo

### Variables de Entorno Requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SECRET_KEY=your_service_role_key
```

### Scripts Package.json

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build", 
    "start": "next start"
  }
}
```

### Archivos Requeridos en /public/

```bash
# Copiar workers PDF.js a /public/
cp node_modules/pdfjs-dist/build/pdf.worker.min.js public/
cp node_modules/pdfjs-dist/build/pdf.worker.mjs public/
```

---

## ✅ Checklist de Implementación

- [x] **Librerías instaladas**: react-pdf, pdfjs-dist
- [x] **Workers copiados**: pdf.worker.min.js en /public/
- [x] **Proxy configurado**: /api/pdf/[id]/route.ts
- [x] **Bucket setup**: BUCKET_PUBLIC configurado
- [x] **Modal component**: DocumentViewerModal implementado
- [x] **Dynamic imports**: SSR disabled para PDF components
- [x] **Error handling**: Fallbacks y error boundaries
- [x] **Performance**: Lazy loading y caching

---

## 🎯 Resumen Técnico

**El preview de documentos en `/fast-sign-docs` utiliza:**

1. **React-PDF 9.2.1** con **PDF.js 3.11.174** para renderizado
2. **Supabase Storage** con bucket `public-documents` para archivos
3. **Proxy API** (`/api/pdf/`) para evitar CORS
4. **Modal dinámico** con lazy loading para performance
5. **Workers optimizados** con fallback automático
6. **Detección inteligente** de documentos con/sin firmas
7. **Caching estratégico** para mejorar velocidad

**Resultado**: Preview rápido, confiable y optimizado de documentos PDF con soporte completo para firmas integradas. 