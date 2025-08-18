"use server"

import { createClient } from "@/utils/supabase/server"
import { logApiUsage } from "./integration-actions"
import { normalizeFileName } from "@/utils/file-utils"

export interface AquariusAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  error?: string
  error_description?: string
}

export interface AquariusDirectory {
  Id: number
  Name: string
  Description?: string
  ParentId?: number
  [key: string]: any
}

export interface AquariusTestResult {
  success: boolean
  message: string
  data?: any
  error?: string
  responseTime: number
  rawResponse?: any
  statusCode?: number
}

export interface AquariusDoctype {
  [key: string]: string
}

export interface AquariusDocumentUploadResult {
  success: boolean
  message: string
  documentId?: string
  error?: string
  responseTime: number
}

export interface AquariusQueryField {
  searchValue?: string
  operatorString: string
  fieldName: string
  description: string
  maxLength: number
  listValues: any[]
}

export interface AquariusQueryDefs {
  fullTextParameter?: string
  queryFields: AquariusQueryField[]
  matchAnyValue: boolean
  folderID: string
  queryType: number
  isFullTextCapable: boolean
}

async function getIntegrationCredentials(integrationId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("User not authenticated")
  }

  // Get integration settings without user restriction (global access)
  const { data, error } = await supabase
    .from("integration_settings")
    .select("settings")
    .eq("id", integrationId)
    .eq("is_enabled", true)  // Only allow access to enabled integrations
    .single()

  if (error || !data) {
    throw new Error("Integration not found or not accessible")
  }

  const settings = data.settings
  if (!settings.api_url || !settings.api_user || !settings.api_password) {
    throw new Error("Integration credentials not configured")
  }

  // Get endpoints from the new JSON structure, fallback to old format
  const endpoints = settings.endpoints || []
  const authEndpoint = endpoints.find((ep: any) => ep.isAuth === true)?.endpoint || settings.auth_endpoint
  const doctypesEndpoint = endpoints.find((ep: any) => ep.isAuth !== true)?.endpoint || settings.doctypes_endpoint
  
  // Find specific endpoints by name/description
  const createDocEndpoint = endpoints.find((ep: any) => 
    ep.name?.toLowerCase().includes('docid') || 
    ep.name?.toLowerCase().includes('document') ||
    ep.endpoint?.includes('/Documents')
  )?.endpoint || '/api/Documents'
  
  const addFileEndpoint = endpoints.find((ep: any) => 
    ep.name?.toLowerCase().includes('file') || 
    ep.name?.toLowerCase().includes('page') ||
    ep.endpoint?.includes('/DocPage')
  )?.endpoint || '/api/DocPages/'

  if (!authEndpoint) {
    throw new Error("Authentication endpoint not configured")
  }

  return {
    apiUrl: settings.api_url,
    username: settings.api_user,
    password: settings.api_password,
    authEndpoint: authEndpoint,
    doctypesEndpoint: doctypesEndpoint,
    createDocEndpoint: createDocEndpoint,
    addFileEndpoint: addFileEndpoint,
    userId: user.id
  }
}

export async function testAquariusAuthentication(integrationId: string): Promise<AquariusTestResult> {
  const startTime = Date.now()
  
  try {
    const { apiUrl, username, password, authEndpoint, userId } = await getIntegrationCredentials(integrationId)
    
    // Clean API URL (remove trailing slash if present) and construct full URL
    const baseUrl = apiUrl.replace(/\/$/, '')
    const tokenUrl = `${baseUrl}${authEndpoint}`
    
    console.log(`Testing authentication at: ${tokenUrl}`)
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: username,
        password: password
      })
    })

    const responseTime = Date.now() - startTime
    const responseText = await response.text()
    
    // Log the API usage
    await logApiUsage(
      integrationId,
      authEndpoint,
      'POST',
      response.status,
      responseTime,
      undefined,
      responseText.length,
      response.ok ? undefined : responseText
    )

    if (!response.ok) {
      return {
        success: false,
        message: `Authentication failed with status ${response.status}`,
        error: responseText,
        responseTime
      }
    }

    const authData: AquariusAuthResponse = JSON.parse(responseText)
    
    if (authData.error) {
      return {
        success: false,
        message: `Authentication error: ${authData.error_description || authData.error}`,
        error: authData.error_description || authData.error,
        responseTime
      }
    }

    return {
      success: true,
      message: `Authentication successful! Token expires in ${authData.expires_in} seconds`,
      data: {
        token_type: authData.token_type,
        expires_in: authData.expires_in,
        token_preview: authData.access_token.substring(0, 20) + '...'
      },
      responseTime
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Log the failed API usage
    try {
      const { authEndpoint } = await getIntegrationCredentials(integrationId)
      await logApiUsage(
        integrationId,
        authEndpoint,
        'POST',
        0,
        responseTime,
        undefined,
        undefined,
        errorMessage
      )
    } catch (logError) {
      console.error('Failed to log API usage:', logError)
    }

    return {
      success: false,
      message: 'Connection failed',
      error: errorMessage,
      responseTime
    }
  }
}

export async function testAquariusDirectories(integrationId: string): Promise<AquariusTestResult> {
  const startTime = Date.now()
  
  try {
    // First authenticate to get token
    const authResult = await testAquariusAuthentication(integrationId)
    if (!authResult.success || !authResult.data) {
      return {
        success: false,
        message: 'Failed to authenticate before testing directories',
        error: authResult.error,
        responseTime: authResult.responseTime
      }
    }

    // Get fresh credentials and token
    const { apiUrl, username, password, authEndpoint, doctypesEndpoint, userId } = await getIntegrationCredentials(integrationId)
    const baseUrl = apiUrl.replace(/\/$/, '')
    
    // Get fresh token for directories call
    const tokenResponse = await fetch(`${baseUrl}${authEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: username,
        password: password
      })
    })

    if (!tokenResponse.ok) {
      return {
        success: false,
        message: 'Failed to get token for directories test',
        error: await tokenResponse.text(),
        responseTime: Date.now() - startTime
      }
    }

    const authData: AquariusAuthResponse = await tokenResponse.json()
    const directoriesUrl = `${baseUrl}${doctypesEndpoint}`
    
    console.log(`Testing directories at: ${directoriesUrl}`)
    
    // Test directories endpoint - Note: Changed to POST as per your requirement
    const dirResponse = await fetch(directoriesUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}) // Empty body for POST request
    })

    const responseTime = Date.now() - startTime
    const responseText = await dirResponse.text()
    
    // Log the API usage
    await logApiUsage(
      integrationId,
      doctypesEndpoint,
      'POST',
      dirResponse.status,
      responseTime - authResult.responseTime, // Subtract auth time
      undefined,
      responseText.length,
      dirResponse.ok ? undefined : responseText
    )

    if (!dirResponse.ok) {
      return {
        success: false,
        message: `Directories request failed with status ${dirResponse.status}`,
        error: responseText,
        responseTime
      }
    }

    const directories: AquariusDirectory[] = JSON.parse(responseText)
    
    return {
      success: true,
      message: `Successfully retrieved ${directories.length} document types/directories`,
      data: {
        count: directories.length,
        directories: directories.slice(0, 5).map(dir => ({
          id: dir.Id,
          name: dir.Name,
          description: dir.Description || 'No description',
          parentId: dir.ParentId
        })),
        hasMore: directories.length > 5
      },
      responseTime
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Log the failed API usage
    try {
      const { doctypesEndpoint } = await getIntegrationCredentials(integrationId)
      await logApiUsage(
        integrationId,
        doctypesEndpoint,
        'POST',
        0,
        responseTime,
        undefined,
        undefined,
        errorMessage
      )
    } catch (logError) {
      console.error('Failed to log API usage:', logError)
    }

    return {
      success: false,
      message: 'Connection failed while testing directories',
      error: errorMessage,
      responseTime
    }
  }
}

export async function testAquariusConnection(integrationId: string): Promise<{
  authTest: AquariusTestResult
  directoriesTest: AquariusTestResult
}> {
  // Test authentication first
  const authTest = await testAquariusAuthentication(integrationId)
  
  let directoriesTest: AquariusTestResult
  
  if (authTest.success) {
    // If auth succeeds, test directories
    directoriesTest = await testAquariusDirectories(integrationId)
  } else {
    // If auth fails, don't test directories
    directoriesTest = {
      success: false,
      message: 'Skipped due to authentication failure',
      error: 'Authentication must succeed before testing other endpoints',
      responseTime: 0
    }
  }

  return {
    authTest,
    directoriesTest
  }
}

export async function testSelectiveEndpoints(
  integrationId: string, 
  selectedEndpointIds: string[]
): Promise<Record<string, AquariusTestResult>> {
  const results: Record<string, AquariusTestResult> = {}
  
  try {
    const { apiUrl, username, password, userId } = await getIntegrationCredentials(integrationId)
    const baseUrl = apiUrl.replace(/\/$/, '')
    
    // Get the integration settings to access endpoints configuration
    const supabase = await createClient()
    const { data: integration } = await supabase
      .from("integration_settings")
      .select("settings")
      .eq("id", integrationId)
      .eq("user_id", userId)
      .single()

    if (!integration?.settings?.endpoints) {
      throw new Error("No endpoints configured for this integration")
    }

    const endpoints = integration.settings.endpoints
    const selectedEndpoints = endpoints.filter((ep: any) => selectedEndpointIds.includes(ep.id))
    
    // Sort endpoints: auth endpoints first, then others
    const authEndpoints = selectedEndpoints.filter((ep: any) => ep.isAuth === true)
    const otherEndpoints = selectedEndpoints.filter((ep: any) => ep.isAuth !== true)
    const sortedEndpoints = [...authEndpoints, ...otherEndpoints]

    let accessToken: string | null = null

    // Test each selected endpoint in order
    for (const endpoint of sortedEndpoints) {
      try {
        if (endpoint.isAuth === true) {
          // For auth endpoints, use the existing authentication test
          const authResult = await testAquariusAuthentication(integrationId)
          results[endpoint.id] = authResult
          
          // If auth succeeds, extract the token for other endpoints
          if (authResult.success && authResult.data) {
            // Get fresh token for subsequent calls
            const tokenResponse = await fetch(`${baseUrl}${endpoint.endpoint}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                grant_type: 'password',
                username: username,
                password: password
              })
            })
            
            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json()
              accessToken = tokenData.access_token
            }
          }
        } else {
          // For non-auth endpoints, test using the access token
          const testResult = await testEndpoint(
            integrationId,
            baseUrl,
            endpoint,
            username,
            password,
            accessToken
          )
          results[endpoint.id] = testResult
        }
      } catch (error) {
        results[endpoint.id] = {
          success: false,
          message: `Failed to test ${endpoint.name}`,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          responseTime: 0
        }
      }
    }

    return results
  } catch (error) {
    // If there's a general error, return error results for all selected endpoints
    const errorResult: AquariusTestResult = {
      success: false,
      message: 'General test failure',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      responseTime: 0
    }

    const errorResults: Record<string, AquariusTestResult> = {}
    selectedEndpointIds.forEach(id => {
      errorResults[id] = errorResult
    })
    
    return errorResults
  }
}

async function testEndpoint(
  integrationId: string,
  baseUrl: string,
  endpoint: any,
  username: string,
  password: string,
  accessToken: string | null
): Promise<AquariusTestResult> {
  const startTime = Date.now()
  
  try {
    const endpointUrl = `${baseUrl}${endpoint.endpoint}`
    
    // Build request options based on endpoint configuration
    const requestOptions: RequestInit = {
      method: endpoint.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    }

    // Add authorization header if we have an access token
    if (accessToken) {
      (requestOptions.headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`
    }

    // For some endpoints that might need basic auth instead
    if (!accessToken && (endpoint.requiresAuth !== false)) {
      const basicAuth = btoa(`${username}:${password}`)
      ;(requestOptions.headers as Record<string, string>)['Authorization'] = `Basic ${basicAuth}`
    }

    console.log(`Testing endpoint: ${endpoint.method} ${endpointUrl}`)
    
    const response = await fetch(endpointUrl, requestOptions)
    const responseTime = Date.now() - startTime
    const responseText = await response.text()
    
    // Log the API usage
    await logApiUsage(
      integrationId,
      endpoint.endpoint,
      endpoint.method || 'GET',
      response.status,
      responseTime,
      undefined,
      responseText.length,
      response.ok ? undefined : responseText
    )

    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = responseText
    }

    if (!response.ok) {
      return {
        success: false,
        message: `${endpoint.name} test failed with status ${response.status}`,
        error: responseText,
        responseTime,
        rawResponse: responseData,
        statusCode: response.status
      }
    }

    // Determine success based on response
    const isSuccess = response.status >= 200 && response.status < 300
    
    return {
      success: isSuccess,
      message: isSuccess 
        ? `${endpoint.name} test successful` 
        : `${endpoint.name} test completed with status ${response.status}`,
      data: responseData,
      responseTime,
      rawResponse: responseData,
      statusCode: response.status
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Log the failed API usage
    try {
      await logApiUsage(
        integrationId,
        endpoint.endpoint,
        endpoint.method || 'GET',
        0,
        responseTime,
        undefined,
        undefined,
        errorMessage
      )
    } catch (logError) {
      console.error('Failed to log API usage:', logError)
    }

    return {
      success: false,
      message: `${endpoint.name} test failed`,
      error: errorMessage,
      responseTime
    }
  }
}

export async function authenticateAquarius(integrationId: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const { apiUrl, username, password, authEndpoint } = await getIntegrationCredentials(integrationId)
    
    const baseUrl = apiUrl.replace(/\/$/, '')
    const tokenUrl = `${baseUrl}${authEndpoint}`
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: username,
        password: password
      })
    })

    if (!response.ok) {
      return { success: false, error: `Authentication failed with status ${response.status}` }
    }

    const authData: AquariusAuthResponse = await response.json()
    
    if (authData.error) {
      return { success: false, error: authData.error_description || authData.error }
    }

    return { success: true, token: authData.access_token }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function getAquariusDoctypes(integrationId: string, token: string): Promise<{ success: boolean; doctypes?: AquariusDoctype; error?: string }> {
  try {
    const { apiUrl, doctypesEndpoint } = await getIntegrationCredentials(integrationId)
    
    if (!doctypesEndpoint) {
      return { success: false, error: 'Doctypes endpoint not configured' }
    }
    
    const baseUrl = apiUrl.replace(/\/$/, '')
    const doctypesUrl = `${baseUrl}${doctypesEndpoint}`
    
    const response = await fetch(doctypesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return { success: false, error: `Failed to fetch doctypes with status ${response.status}` }
    }

    const rawDoctypes = await response.json()
    console.log('Raw doctypes response:', rawDoctypes)
    
    // Convert array format to key-value object format
    let doctypes: AquariusDoctype = {}
    
    if (Array.isArray(rawDoctypes)) {
      // Handle array format: [{ key: 'id', value: 'name' }, ...]
      doctypes = rawDoctypes.reduce((acc, item) => {
        if (item.key && item.value) {
          acc[item.key] = item.value
        }
        return acc
      }, {} as AquariusDoctype)
    } else if (typeof rawDoctypes === 'object' && rawDoctypes !== null) {
      // Handle object format: { 'id': 'name', ... }
      doctypes = rawDoctypes
    }
    
    console.log('Processed doctypes:', doctypes)
    return { success: true, doctypes }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function getAquariusQueryDefs(integrationId: string, token: string, doctypeId: string): Promise<{ success: boolean; queryDefs?: AquariusQueryDefs; error?: string }> {
  try {
    const { apiUrl } = await getIntegrationCredentials(integrationId)
    
    const baseUrl = apiUrl.replace(/\/$/, '')
    const queryDefsUrl = `${baseUrl}/api/QueryDefs/${doctypeId}`
    
    console.log('Fetching query definitions from:', queryDefsUrl)
    
    const response = await fetch(queryDefsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return { success: false, error: `Failed to fetch query definitions with status ${response.status}` }
    }

    const queryDefs: AquariusQueryDefs = await response.json()
    console.log('Raw query definitions response:', queryDefs)
    
    return { success: true, queryDefs }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function uploadDocumentToAquarius(
  integrationId: string, 
  token: string, 
  doctype: string, 
  pdfBlob: Blob, 
  filename: string,
  indexData: Array<{ fieldName: string; value: string }> = []
): Promise<AquariusDocumentUploadResult> {
  const startTime = Date.now()
  
  try {
    const { apiUrl, createDocEndpoint, addFileEndpoint } = await getIntegrationCredentials(integrationId)
    
    const baseUrl = apiUrl.replace(/\/$/, '')
    const documentsUrl = `${baseUrl}${createDocEndpoint}`
    
    console.log('Aquarius Upload: Using API URL:', apiUrl)
    console.log('Aquarius Upload: Base URL:', baseUrl)
    console.log('Aquarius Upload: Create Doc Endpoint:', createDocEndpoint)
    console.log('Aquarius Upload: Add File Endpoint:', addFileEndpoint)
    console.log('Aquarius Upload: Documents URL:', documentsUrl)
    
    console.log('Aquarius Upload: Step 1 - Creating document...')
    
    // Step 1: Create document to get docID
    const documentData = {
      application: null,
      doctype: doctype,
      pages: [], // Empty pages array for document creation
      docID: null,
      indexData: indexData
    }
    
    const createResponse = await fetch(documentsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(documentData)
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.log('Aquarius Upload: Document creation failed:', errorText)
      return {
        success: false,
        message: `Failed to create document with status ${createResponse.status}`,
        error: errorText,
        responseTime: Date.now() - startTime
      }
    }

    const docID = await createResponse.text() // API returns docID as a plain string
    
    if (!docID || docID.trim() === '') {
      console.log('Aquarius Upload: No docID returned from document creation')
      return {
        success: false,
        message: 'Failed to get document ID from Aquarius',
        error: 'No docID returned from document creation',
        responseTime: Date.now() - startTime
      }
    }
    
    console.log('Aquarius Upload: Document created with ID:', docID)
    console.log('Aquarius Upload: Step 2 - Uploading PDF pages...')
    
    // Step 2: Upload PDF pages using the docID
    const cleanDocID = docID.replace(/['"\\]/g, '') // Remove any quotes or backslashes
    // Use configured endpoint - if it ends with /, append docID, otherwise append /{docID}
    const fileEndpoint = addFileEndpoint.endsWith('/') 
      ? `${addFileEndpoint}${cleanDocID}` 
      : `${addFileEndpoint}/${cleanDocID}`
    const docPagesUrl = `${baseUrl}${fileEndpoint}`
    
    console.log('Aquarius Upload: Upload URL:', docPagesUrl)
    console.log('Aquarius Upload: URL Protocol:', new URL(docPagesUrl).protocol)
    
    // Create FormData with the PDF file
    // Normalize the filename to handle accented characters and special characters
    const normalizedFilename = filename ? normalizeFileName(filename) : 'signed-document.pdf'
    const formData = new FormData()
    formData.append('filestream', pdfBlob, normalizedFilename)
    
    console.log('Aquarius Upload: FormData created, file size:', pdfBlob.size)
    console.log('Aquarius Upload: Original filename:', filename)
    console.log('Aquarius Upload: Normalized filename:', normalizedFilename)
    
    const uploadResponse = await fetch(docPagesUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Don't set Content-Type - let browser set it for multipart/form-data
      },
      body: formData
    })
    
    console.log('Aquarius Upload: Response status:', uploadResponse.status)
    console.log('Aquarius Upload: Response headers:', Object.fromEntries(uploadResponse.headers.entries()))

    const responseTime = Date.now() - startTime
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.log('Aquarius Upload: PDF upload failed:', errorText)
      return {
        success: false,
        message: `Failed to upload PDF with status ${uploadResponse.status}`,
        error: errorText,
        responseTime
      }
    }

    const uploadResult = await uploadResponse.json()
    console.log('Aquarius Upload: PDF uploaded successfully:', uploadResult)
    
    return {
      success: true,
      message: 'Document uploaded successfully to Aquarius',
      documentId: docID,
      responseTime
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.log('Aquarius Upload: Error occurred:', errorMessage)
    return {
      success: false,
      message: 'Failed to upload document',
      error: errorMessage,
      responseTime
    }
  }
}
