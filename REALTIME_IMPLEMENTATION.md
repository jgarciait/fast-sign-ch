# Implementación de Realtime para Case Files

## Descripción General

Este documento describe la implementación de funcionalidad de realtime usando Supabase para el sistema de case-files, específicamente para la sincronización automática de cambios en las categorías de documentos.

## Componentes Implementados

### 1. Hook personalizado: `useDocumentRealtime`

**Ubicación:** `hooks/use-document-realtime.ts`

Este hook maneja las subscripciones de realtime a las tablas de Supabase:

- **Tabla `documents`**: Escucha cambios en la columna `category_id` y otros campos
- **Tabla `document_categories`**: Escucha actualizaciones y eliminaciones de categorías

**Características:**
- Subscripción automática con filtros por `file_record_id`
- Callbacks configurables para diferentes tipos de eventos
- Cleanup automático al desmontar el componente
- Opción para habilitar/deshabilitar subscripciones

**Uso:**
```typescript
useDocumentRealtime({
  fileRecordId: "uuid-del-case-file",
  onDocumentUpdate: (document) => { /* manejar actualización */ },
  onCategoryUpdate: (category) => { /* manejar actualización */ },
  onCategoryDelete: (categoryId) => { /* manejar eliminación */ },
  enabled: true // opcional, por defecto true
})
```

### 2. Componente actualizado: `CompactCaseFileDocuments`

**Ubicación:** `components/compact-case-file-documents.tsx`

**Cambios implementados:**
- Import del hook `useDocumentRealtime`
- Callbacks para manejar actualizaciones en tiempo real
- Sincronización automática de estado local con cambios remotos
- Notificaciones toast para cambios recibidos
- Enriquecimiento automático de documentos con información de categoría

**Funcionalidades realtime:**
- Actualización automática cuando se cambia la categoría de un documento
- Sincronización de cambios en nombres/colores/iconos de categorías
- Manejo automático de eliminación de categorías

### 3. Componente actualizado: `EnhancedCaseFileDocuments`

**Ubicación:** `components/enhanced-case-file-documents.tsx`

**Cambios implementados:**
- Import del hook `useDocumentRealtime`
- Callbacks más complejos para manejar múltiples estados (documentos categorizados, sin categorizar, documentos de categoría actual)
- Manejo inteligente de vista de categoría actual
- Actualización automática de contadores de documentos por categoría

**Funcionalidades realtime avanzadas:**
- Sincronización de documentos entre vista categorizada y sin categorizar
- Cambio automático de vista si se elimina la categoría actual
- Actualización de múltiples estados de documentos simultáneamente

## API Endpoints Relacionados

### Cambio de Categoría
**Endpoint:** `POST /api/documents/[documentId]/move-to-category`

Este endpoint ya existe y funciona correctamente. Los cambios se realizan en la base de datos y son detectados automáticamente por las subscripciones de realtime.

**Payload:**
```json
{
  "categoryId": "uuid-de-categoria" // o null para sin categorizar
}
```

## Configuración de Supabase

### Prerequisitos
Las siguientes tablas deben tener realtime habilitado en Supabase:

1. **Tabla `documents`**
   - Publicar cambios en `category_id`, `updated_at`
   - Filtros disponibles por `file_record_id`

2. **Tabla `document_categories`**
   - Publicar cambios en `name`, `color`, `icon`
   - Publicar eventos de eliminación
   - Filtros disponibles por `file_record_id`

### Comando SQL para habilitar realtime:
```sql
-- Habilitar realtime para documentos
ALTER PUBLICATION supabase_realtime ADD TABLE documents;

-- Habilitar realtime para categorías
ALTER PUBLICATION supabase_realtime ADD TABLE document_categories;
```

## Flujo de Funcionamiento

### Cambio de Categoría de Documento

1. **Usuario realiza cambio** en la UI (arrastra documento, selecciona categoría)
2. **API call** se realiza a `/api/documents/[documentId]/move-to-category`
3. **Base de datos se actualiza** con el nuevo `category_id`
4. **Supabase Realtime detecta el cambio** y lo propaga
5. **Hook `useDocumentRealtime` recibe el evento** en todos los clientes conectados
6. **Callback `onDocumentUpdate` se ejecuta** en cada componente subscrito
7. **Estado local se actualiza** automáticamente
8. **UI se re-renderiza** con los nuevos datos
9. **Toast notification** informa al usuario del cambio

### Eliminación de Categoría

1. **Categoría se elimina** vía API
2. **Realtime detecta DELETE event** en `document_categories`
3. **Callback `onCategoryDelete` se ejecuta**
4. **Documentos afectados se mueven** automáticamente a "sin categorizar"
5. **Vista cambia automáticamente** si el usuario estaba viendo la categoría eliminada
6. **UI se actualiza** en tiempo real

## Beneficios de la Implementación

### Para Usuarios
- **Sincronización instantánea** entre múltiples usuarios
- **Feedback visual inmediato** cuando otros usuarios realizan cambios
- **Experiencia fluida** sin necesidad de recargar página
- **Notificaciones informativas** sobre cambios realizados por otros

### Para Desarrolladores
- **Hook reutilizable** para otras funcionalidades de realtime
- **Gestión automática de subscripciones** y cleanup
- **Separación clara de responsabilidades**
- **Manejo robusto de errores** y estados edge case

## Monitoreo y Debugging

### Logs de Consola
El sistema incluye logs detallados para debugging:

```javascript
// Logs del hook
console.log('🚀 Setting up realtime subscriptions for case file:', fileRecordId)
console.log('📄 Document update received:', payload)
console.log('🏷️ Category update received:', payload)

// Logs de componentes
console.log('🔄 Realtime document update received:', updatedDocument)
console.log('🏷️ Enhanced: Realtime category update received:', updatedCategory)
```

### Verificación de Funcionamiento
1. Abrir múltiples ventanas/tabs del mismo case file
2. Realizar cambio de categoría en una ventana
3. Verificar que el cambio se refleje automáticamente en las otras ventanas
4. Observar las notificaciones toast y logs de consola

## Notas Técnicas

- **Performance**: Las subscripciones están filtradas por `file_record_id` para minimizar tráfico
- **Memory leaks**: Cleanup automático de subscripciones al desmontar componentes
- **Modo read-only**: Realtime se deshabilita automáticamente en modo solo lectura
- **Consistencia**: Estado local se mantiene consistente con actualizaciones optimistas y rollback en caso de error

## Futuras Mejoras

1. **Batching de actualizaciones** para múltiples cambios simultáneos
2. **Indicators visuales** de usuarios activos viendo el mismo case file
3. **Conflicto resolution** para cambios simultáneos
4. **Offline support** con sincronización al reconectar