# Document and Case File Management Changes - GLOBAL ACCESS

## Overview
This document outlines the major changes implemented to the document and case file management system as requested. The changes implement **COMPLETELY GLOBAL ACCESS** where:

1. **Filing Systems**: All users can view, create, edit, and delete all filing systems
2. **Case Files (file_records)**: All users can view, create, edit, and delete all case files
3. **Documents**: All users can view, create, edit, and delete all documents
4. **Creator identification**: All entities maintain creator information for reference/display purposes

## Database Changes

### New Column Added
- `file_records.assigned_to_user_id` - UUID field that allows case files to be assigned to specific users

### Updated RLS Policies - COMPLETELY GLOBAL

#### Filing Systems Table
- **OLD**: Users could only see their own filing systems (`user_id = auth.uid()`)
- **NEW**: All authenticated users can view, create, edit, and delete ALL filing systems (`true`)
- **Creator identification**: Filing systems track who created them via `user_id` for reference

#### Documents Table
- **OLD**: Users could only see their own documents (`user_id = auth.uid()`)
- **NEW**: All authenticated users can view, create, edit, and delete ALL documents (`true`)
- **Creator identification**: Documents track who created them via `user_id` for reference

#### File Records (Case Files) Table  
- **OLD**: Users could only see their own case files (`user_id = auth.uid()`)
- **NEW**: All authenticated users can view, create, edit, and delete ALL case files (`true`)
- **Creator identification**: Case files track who created them via `user_id` for reference
- **Assignment**: Assignment field maintained for workflow purposes, but doesn't restrict access

#### Related Tables - All Global
- `filing_indices`: All users can view and manage all filing indices
- `document_signatures`: All users can view and manage all document signatures
- `document_annotations`: All users can view and manage all document annotations
- `signing_requests`: All authenticated users can manage all signing requests

## Server Actions Updated

### New Functions Added
1. `assignFileRecord(recordId, assignedToUserId)` - Assign a case file to a user (any user can assign any case file)
2. `getUsersForAssignment()` - Get list of users for assignment dropdown
3. `getAssignedFileRecords()` - Get case files assigned to current user
4. `getFileRecordAccessInfo(recordId)` - Get case file creator and assignment info (all users have full access)

### Updated Functions - All Now Global Access
1. `getFilingSystems()` - Returns ALL filing systems with creator information
2. `getActiveFilingSystem()` - Returns the active filing system (globally accessible)
3. `getDocuments()` - Returns ALL documents with creator information
4. `getFileRecords()` - Returns ALL case files with creator and assignment information
5. `getFileRecordById()` - Returns any case file by ID with full information
6. `updateFileRecord()` - Any user can update any case file
7. `deleteFileRecord()` - Any user can delete any case file
8. `getDocumentsByFileRecord()` - Returns all documents for any case file
9. `searchFileRecords()` - Search across all case files
10. `getRequests()` - Returns all requests with creator information
11. `getRequestById()` - Returns any request by ID with creator information

## Helper Functions Created
1. `get_file_record_access_info(p_file_record_id, p_user_id)` - Database function to check access permissions
2. `get_document_creator_info(p_document_id)` - Database function to get creator information

## Usage Examples

### Assigning a Case File
\`\`\`typescript
// Any user can assign any case file to any user
const result = await assignFileRecord(caseFileId, userId);
\`\`\`

### Getting All Filing Systems
\`\`\`typescript
// Gets ALL filing systems with creator information
const { systems } = await getFilingSystems();
\`\`\`

### Getting All Case Files
\`\`\`typescript
// Gets ALL case files with creator and assignment information
const { records } = await getFileRecords();
\`\`\`

### Getting All Documents
\`\`\`typescript
// Gets ALL documents with creator information
const { documents } = await getDocuments();
\`\`\`

### Getting Assigned Case Files Only
\`\`\`typescript
// Gets only case files assigned to current user (for workflow filtering)
const { records } = await getAssignedFileRecords();
\`\`\`

### Getting Creator and Assignment Info
\`\`\`typescript
// Get creator and assignment info for any case file
const { access } = await getFileRecordAccessInfo(caseFileId);
// Returns: { can_view: true, can_edit: true, is_creator, is_assigned }
// Note: can_view and can_edit are always true for all users
\`\`\`

## UI Implications - GLOBAL ACCESS

### Filing System Lists
- All filing systems are visible and editable by all users
- Creator information should be displayed for reference
- All users can create, edit, delete, and activate filing systems

### Document Lists
- All documents are visible and editable by all users
- Creator information should be displayed (name from profiles table)
- All users can create, edit, and delete any document

### Case File Lists  
- All case files are visible and editable by all users
- Display creator and assignment information for reference
- Assignment controls available to all users
- All users can create, edit, and delete any case file

### Case File Assignment
- Dropdown of all users for assignment
- All users can assign any case file to any user
- Assignment is for workflow organization, not access control

## Security Considerations - GLOBAL ACCESS

1. **Complete Global Access**: ALL filing systems, case files, and documents are accessible to ALL authenticated users
2. **No Access Restrictions**: Any user can view, create, edit, and delete any content
3. **Creator Tracking**: Creator information is maintained for reference and audit purposes only
4. **Assignment Tracking**: Assignment information is maintained for workflow organization only
5. **Data Integrity**: RLS policies enforce authentication requirement at the database level

## Migration Required

Run the SQL migration files in order:
1. `db/update-document-case-file-access.sql` (initial changes)
2. `db/update-global-access.sql` (complete global access)

These migrations:
1. Add the `assigned_to_user_id` column
2. Update all RLS policies to allow global access
3. Create helper functions
4. Add necessary indexes

## Testing Recommendations

1. Test document visibility across different users
2. Test case file assignment functionality
3. Verify edit permissions work correctly for assigned users
4. Test that only creators can delete case files
5. Verify all related tables (signatures, annotations) work with new access patterns

## Breaking Changes

⚠️ **CRITICAL**: This is a major breaking change that implements **COMPLETE GLOBAL ACCESS**:
- **Filing systems**: Now globally accessible to all users (create, read, update, delete)
- **Documents**: Now globally accessible to all users (create, read, update, delete)  
- **Case files**: Now globally accessible to all users (create, read, update, delete)
- **No access restrictions**: Any authenticated user can modify any content
- **Creator/assignment info**: Maintained for reference only, not access control

**SECURITY WARNING**: This removes ALL access restrictions. Ensure this aligns with your business requirements before deploying to production.

Ensure all UI components are updated to handle the new completely global access patterns and display creator/assignment information appropriately.
