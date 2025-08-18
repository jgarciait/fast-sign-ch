"use server"

import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)

type SendDocumentEmailParams = {
  recipientEmail: string
  recipientName: string
  documentTitle: string
  documentId: string
  message: string
  baseUrl?: string // Make this optional for backward compatibility
  signingId?: string // Unique signing ID for this specific request
}

export async function sendDocumentEmail({
  recipientEmail,
  recipientName,
  documentTitle,
  documentId,
  message,
  baseUrl: providedBaseUrl,
  signingId,
}: SendDocumentEmailParams) {
  try {
    // Generate a unique token for the signing link
    // If signingId is provided, use it; otherwise fall back to email-only token for backward compatibility
    const token = signingId 
      ? Buffer.from(`${recipientEmail}:${signingId}`).toString("base64")
      : Buffer.from(`${recipientEmail}`).toString("base64")

    // Create the signing link with the correct production URL
    // Use provided baseUrl if available, otherwise determine it
    const baseUrl =
      providedBaseUrl ||
      (process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : process.env.NEXT_PUBLIC_SITE_URL
          ? process.env.NEXT_PUBLIC_SITE_URL
          : process.env.NODE_ENV === "development"
            ? `http://localhost:${process.env.PORT || "3000"}`
            : "http://localhost:3000")

    // Update the signing link to use the new direct view route
    // Find the line where signLink is defined and update it:
    const signLink = `${baseUrl}/sign/${documentId}?token=${token}`

    // Add a direct view link
    const viewLink = `${baseUrl}/view/${documentId}?token=${token}`

    // Update the email HTML to include only sign button
    const emailHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=width=device-width, initial-scale=1.0">
    <title>Documento Listo para Firmar</title>
  </head>
  <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; padding: 20px;">
    <h1 style="font-size: 24px; margin-bottom: 20px;">Documento Listo para Firmar</h1>
    
    <p>Hola ${recipientName || recipientEmail.split("@")[0]},</p>
    
    <p>Ha recibido un documento titulado <strong>${documentTitle}</strong> que requiere su firma.</p>
    
    <p style="white-space: pre-line;">${message}</p>
    
    <div style="text-align: center; margin: 25px 0;">
      <a href="${signLink}" style="background-color: #0D2340; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold; display: inline-block;">
        Firmar Documento
      </a>
    </div>
    
    <p>O copie y pegue este enlace en su navegador:</p>
    
    <p style="word-break: break-all; color: #4F46E5;">
      <a href="${signLink}" style="color: #4F46E5;">${signLink}</a>
    </p>
    
    <p>Este enlace expirará en 7 días.</p>
    
    <p>
      Gracias,<br>
      Equipo AQSign
    </p>
  </body>
  </html>
`

    // Send the email
    const { data, error } = await resend.emails.send({
      from: "AQSign <sent2sign@aqplatform.app>",
      to: [recipientEmail],
      subject: documentTitle,
      html: emailHtml,
      // Update the text version as well
      text: `Hola ${recipientName || recipientEmail.split("@")[0]},

Ha recibido un documento titulado "${documentTitle}" que requiere su firma.

${message}

Por favor visite el siguiente enlace para firmar:
${signLink}

Este enlace expirará en 7 días.

Gracias,
Equipo AQSign`,
    })

    if (error) {
      console.error("Error sending email:", error)
      return { error: error.message }
    }

    console.log("Email sent successfully:", data)
    return { success: true, data }
  } catch (error) {
    console.error("Error sending email:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}
