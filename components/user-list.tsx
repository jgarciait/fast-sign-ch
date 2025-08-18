"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { getAppUsers, resetUserPassword, type AppUser } from "@/app/actions/user-management-actions"
import { format } from "date-fns"

export default function UserList() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [resettingUserId, setResettingUserId] = useState<string | null>(null)
  const { toast } = useToast()

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const { users: fetchedUsers, error } = await getAppUsers()
      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        })
      } else if (fetchedUsers) {
        setUsers(fetchedUsers)
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to load users.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleResetPassword = async (userId: string, userEmail: string) => {
    setResettingUserId(userId)
    try {
      const { success, error } = await resetUserPassword(userId, userEmail)
      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        })
      } else if (success) {
        toast({
          title: "Password Reset Initiated",
          description: "A password reset email has been sent to the user.",
        })
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to initiate password reset.",
        variant: "destructive",
      })
    } finally {
      setResettingUserId(null)
    }
  }

  const formatName = (firstName: string | null, lastName: string | null) => {
    if (!firstName && !lastName) return "N/A"
    return `${firstName || ""} ${lastName || ""}`.trim()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Users</CardTitle>
        <CardDescription>View and manage all registered users in your application.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : users.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No users found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{formatName(user.first_name, user.last_name)}</TableCell>
                  <TableCell>{user.created_at ? format(new Date(user.created_at), "PPP") : "N/A"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetPassword(user.id, user.email)}
                      disabled={resettingUserId === user.id}
                    >
                      {resettingUserId === user.id ? "Sending..." : "Reset Password"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
