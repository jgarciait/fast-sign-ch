# 📁 Enhanced Case File Document Management System

## 🚀 **Overview**

The Enhanced Case File Document Management System provides a comprehensive solution for organizing, categorizing, and managing thousands of documents within case files (expedientes). This system features advanced pagination, dynamic categorization, bulk operations, and dual view modes with drag-and-drop functionality.

## ✨ **Key Features**

### 🗂️ **Dynamic Document Categories**
- **Folder-like Organization**: Create custom categories that act like folders
- **Hierarchical Structure**: Support for nested categories (parent-child relationships)
- **Visual Color Coding**: Each category has customizable colors and icons
- **Auto-Categorization**: Automatic document categorization based on filename patterns
- **Drag & Drop**: Move documents between categories with intuitive drag-and-drop

### 📊 **Dual View Modes**
1. **List View**: Traditional table-style document listing with detailed information
2. **Folder View**: Visual folder-based organization with expandable categories

### 🔍 **Advanced Search & Filtering**
- **Real-time Search**: Search by filename or document type
- **Category Filtering**: Filter documents by specific categories
- **Uncategorized Filter**: Quickly find documents without categories
- **Search Highlighting**: Visual indication of search matches

### 📄 **Pagination System**
- **Efficient Loading**: Handle thousands of documents with 20 items per page
- **Performance Optimized**: Database-level pagination for fast loading
- **Navigation Controls**: Easy page navigation with current page indicators

### ⚡ **Bulk Operations**
- **Multi-Select**: Select individual documents or all documents at once
- **Bulk Unlink**: Remove multiple documents from case file simultaneously
- **Bulk Delete**: Delete multiple documents with confirmation
- **Visual Feedback**: Clear indication of selected documents and progress

### 🎯 **Document Actions**
- **View**: Open document in viewer
- **Download**: Direct download from browser
- **Edit**: Open in Fast Sign editor
- **Unlink**: Remove from case file (document remains in system)
- **Delete**: Permanently delete document

## 🗄️ **Database Schema**

### **New Tables**

#### `document_categories`
\`\`\`sql
CREATE TABLE document_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_record_id UUID NOT NULL REFERENCES file_records(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    icon TEXT DEFAULT 'folder',
    parent_category_id UUID REFERENCES document_categories(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_category_name_per_level UNIQUE (file_record_id, name, parent_category_id)
);
\`\`\`

### **Enhanced Tables**

#### `documents` (New Columns)
\`\`\`sql
-- Link documents to categories
ALTER TABLE documents ADD COLUMN category_id UUID REFERENCES document_categories(id) ON DELETE SET NULL;

-- Store additional metadata for case file context
ALTER TABLE documents ADD COLUMN case_file_metadata JSONB DEFAULT '{}';
\`\`\`

### **Database Functions**

#### `get_category_hierarchy(p_file_record_id UUID)`
Returns hierarchical category structure with document counts:
- Recursive function for nested categories
- Includes document count per category
- Ordered by level and category name

#### `move_document_to_category(p_document_id UUID, p_category_id UUID)`
Safely moves documents between categories:
- Updates document category assignment
- Handles null category (uncategorized)
- Updates timestamp

#### `bulk_unlink_documents_from_case_file(p_document_ids UUID[])`
Bulk operation for unlinking documents:
- Removes file_record_id association
- Clears category assignment
- Resets case file metadata
- Returns count of unlinked documents

### **Database Views**

#### `case_file_documents_with_categories`
Comprehensive view combining documents with category information:
- Document details with category metadata
- Category color and icon information
- Breadcrumb path for nested categories
- Document count per category

## 🎨 **Default Categories**

The system automatically creates three default categories for each case file:

1. **📄 Contratos** (Green `#10B981`)
   - For contractual documents and agreements
   - Auto-categorizes files with "contrato" or "contract" in filename

2. **📋 Formularios** (Orange `#F59E0B`)
   - For forms and informational documents
   - Auto-categorizes files with "form" or "formulario" in filename

3. **✅ Firmados** (Purple `#8B5CF6`)
   - For signed and completed documents
   - Auto-categorizes files starting with "SIGNED_" or containing "_signed"

## 🔧 **API Endpoints**

### Document Management
- `GET /api/case-files/[fileRecordId]/documents` - Paginated document listing
- `GET /api/case-files/[fileRecordId]/categories` - Category hierarchy
- `POST /api/case-files/[fileRecordId]/categories` - Create new category
- `POST /api/case-files/[fileRecordId]/bulk-unlink` - Bulk unlink documents
- `POST /api/documents/[documentId]/move-to-category` - Move document to category

### Query Parameters
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `search`: Search term for filename/type
- `category`: Category filter ('all', 'uncategorized', or category ID)

## 🎯 **Usage Examples**

### **Creating Categories**
\`\`\`typescript
// Create a new category
const response = await fetch(`/api/case-files/${fileRecordId}/categories`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Documentos Legales',
    description: 'Documentos legales y jurídicos',
    color: '#DC2626',
    icon: 'scale'
  })
});
\`\`\`

### **Moving Documents**
\`\`\`typescript
// Move document to category via drag-and-drop
const response = await fetch(`/api/documents/${documentId}/move-to-category`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ categoryId: targetCategoryId })
});
\`\`\`

### **Bulk Operations**
\`\`\`typescript
// Unlink multiple documents
const response = await fetch(`/api/case-files/${fileRecordId}/bulk-unlink`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ documentIds: selectedDocumentIds })
});
\`\`\`

## 🔒 **Security Features**

### **Row Level Security (RLS)**
- Categories inherit file record permissions
- Only authorized users can view/modify categories
- Document access follows existing permissions

### **Permission Checks**
- File record ownership verification
- User assignment validation
- Category ownership validation for moves

### **Data Validation**
- Required field validation
- Unique category names per level
- Category-file record relationship validation

## 🎨 **UI Components**

### **EnhancedCaseFileDocuments**
Main component providing:
- Document listing with pagination
- Category management
- Drag-and-drop interface
- Bulk selection and operations
- Search and filtering

### **Key Props**
\`\`\`typescript
interface EnhancedCaseFileDocumentsProps {
  fileRecordId: string                                    // Case file ID
  onDocumentAction?: (action: string, documentId: string) => void  // Document action handler
  onBulkAction?: (action: string, documentIds: string[]) => void   // Bulk action handler
  readOnly?: boolean                                      // Read-only mode
}
\`\`\`

## 📱 **Responsive Design**

- **Mobile Optimized**: Responsive layouts for all screen sizes
- **Touch Friendly**: Large touch targets for mobile devices
- **Adaptive UI**: Components adjust to available space
- **Progressive Enhancement**: Core functionality works without JavaScript

## ⚡ **Performance Optimizations**

### **Database Level**
- Indexed foreign keys for fast queries
- Optimized recursive category queries
- Efficient pagination with LIMIT/OFFSET
- GIN index on JSONB metadata fields

### **Frontend Level**
- Virtualized lists for large document sets
- Debounced search to reduce API calls
- Optimistic UI updates for better UX
- Lazy loading of category trees

### **Caching Strategy**
- Category hierarchy caching
- Document metadata caching
- Search result caching
- Optimistic updates with rollback

## 🔄 **Auto-Categorization Rules**

Documents are automatically categorized based on filename patterns:

1. **Signed Documents** → "Firmados" category
   - Filenames starting with "SIGNED_"
   - Filenames containing "_signed"

2. **Contracts** → "Contratos" category
   - Filenames containing "contrato" or "contract"

3. **Forms** → "Formularios" category
   - Filenames containing "form" or "formulario"

## 🚀 **Migration Guide**

### **Running the Database Migration**
\`\`\`sql
-- Execute the migration script
\i add-document-categories-system.sql
\`\`\`

### **Updating Existing Case Files**
The migration automatically:
1. Creates default categories for existing case files
2. Adds necessary indexes for performance
3. Sets up Row Level Security policies
4. Creates database functions and views

## 🎯 **Best Practices**

### **Category Organization**
- Use descriptive category names
- Limit nesting to 2-3 levels maximum
- Choose distinct colors for easy identification
- Keep category names consistent across case files

### **Document Management**
- Use bulk operations for efficiency
- Regularly review uncategorized documents
- Utilize search functionality for large document sets
- Take advantage of auto-categorization

### **Performance**
- Use pagination for large document sets
- Implement search filters to reduce data load
- Monitor database query performance
- Regular maintenance of indexes

## 🐛 **Troubleshooting**

### **Common Issues**

1. **Categories not loading**
   - Check file record permissions
   - Verify database function exists
   - Check network connectivity

2. **Drag-and-drop not working**
   - Ensure @hello-pangea/dnd is installed
   - Check for JavaScript errors
   - Verify category permissions

3. **Bulk operations failing**
   - Check document permissions
   - Verify API endpoint accessibility
   - Check for network timeouts

### **Performance Issues**
- Enable database query logging
- Monitor API response times
- Check for memory leaks in frontend
- Optimize database indexes

## 📈 **Future Enhancements**

### **Planned Features**
- **Advanced Search**: Full-text search within documents
- **Category Templates**: Predefined category sets for different case types
- **Document Versioning**: Track document changes over time
- **Audit Trail**: Complete history of document operations
- **Export/Import**: Bulk category and document operations
- **AI Categorization**: Machine learning-based auto-categorization

### **Integration Opportunities**
- **External Storage**: Support for cloud storage providers
- **Document Processing**: OCR and content extraction
- **Workflow Integration**: Connect with business process tools
- **Reporting**: Advanced analytics and reporting features

---

## 📞 **Support**

For questions or issues with the Enhanced Case File Document Management System, please refer to the main project documentation or contact the development team.

**Key Benefits:**
✅ **Scalable**: Handle thousands of documents efficiently  
✅ **Intuitive**: User-friendly drag-and-drop interface  
✅ **Flexible**: Customizable categories and organization  
✅ **Secure**: Comprehensive permission system  
✅ **Fast**: Optimized for performance at scale
