import { logApiUsage } from "@/app/actions/integration-actions"

/**
 * Utility class for logging API usage to track integration statistics
 */
export class ApiLogger {
  private integrationId: string
  private startTime: number

  constructor(integrationId: string) {
    this.integrationId = integrationId
    this.startTime = Date.now()
  }

  /**
   * Log an API call with response details
   */
  async logCall(
    endpoint: string,
    method: string,
    statusCode: number,
    options?: {
      requestSizeBytes?: number
      responseSizeBytes?: number
      errorMessage?: string
    }
  ) {
    const responseTime = Date.now() - this.startTime

    try {
      await logApiUsage(
        this.integrationId,
        endpoint,
        method,
        statusCode,
        responseTime,
        options?.requestSizeBytes,
        options?.responseSizeBytes,
        options?.errorMessage
      )
    } catch (error) {
      console.error("Failed to log API usage:", error)
      // Don't throw error to avoid breaking the main functionality
    }
  }

  /**
   * Log a successful API call
   */
  async logSuccess(endpoint: string, method: string, statusCode: number = 200, responseSizeBytes?: number) {
    await this.logCall(endpoint, method, statusCode, { responseSizeBytes })
  }

  /**
   * Log a failed API call
   */
  async logError(endpoint: string, method: string, statusCode: number, errorMessage: string) {
    await this.logCall(endpoint, method, statusCode, { errorMessage })
  }
}

/**
 * Helper function to create an API logger for a specific integration
 */
export function createApiLogger(integrationId: string): ApiLogger {
  return new ApiLogger(integrationId)
}

/**
 * Example usage in your API calls:
 * 
 * ```typescript
 * const logger = createApiLogger(integrationId)
 * 
 * try {
 *   const response = await fetch('https://api.aquarius-software.com/documents', {
 *     method: 'POST',
 *     headers: { 'Authorization': `Bearer ${apiKey}` },
 *     body: JSON.stringify(data)
 *   })
 *   
 *   if (response.ok) {
 *     await logger.logSuccess('/documents', 'POST', response.status)
 *   } else {
 *     await logger.logError('/documents', 'POST', response.status, await response.text())
 *   }
 * } catch (error) {
 *   await logger.logError('/documents', 'POST', 0, error.message)
 * }
 * ```
 */
