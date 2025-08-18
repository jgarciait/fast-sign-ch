"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { generateInvitationCode } from "@/app/actions/user-management-actions"

export default function InviteUserForm() {
  const [email, setEmail] = useState("")
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleGenerateCode = async () => {
    setIsLoading(true)
    setGeneratedCode(null)
    try {
      const { code, error } = await generateInvitationCode(email)
      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        })
      } else if (code) {
        setGeneratedCode(code)
        toast({
          title: "Success",
          description: `Invitation code generated: ${code}`,
        })
        setEmail("") // Clear email after successful generation
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to generate invitation code.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite New User</CardTitle>
        <CardDescription>Generate an invitation code for a new user to sign up.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="invite-email">Recipient Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
          />
        </div>
        <Button onClick={handleGenerateCode} disabled={isLoading || !email}>
          {isLoading ? "Generating..." : "Generate Invitation Code"}
        </Button>
        {generatedCode && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-800">
            <p className="font-medium">Invitation Code:</p>
            <p className="text-2xl font-bold tracking-widest">{generatedCode}</p>
            <p className="text-sm mt-1">Share this code with {email} for registration.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
