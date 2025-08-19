import React from "react"
import ChoferAssignmentsDashboard from "@/components/chofer-assignments-dashboard"
import AdminAssignmentsDashboard from "@/components/admin-assignments-dashboard"
import MobileChoferDashboard from "@/components/mobile-chofer-dashboard"
import { UserRoleAwarePage } from "@/components/user-role-aware-page"

export default function MisAsignacionesPage() {
  return (
    <UserRoleAwarePage
      choferComponent={<ChoferAssignmentsDashboard />}
      mobileChoferComponent={<MobileChoferDashboard />}
      adminComponent={<AdminAssignmentsDashboard />}
    />
  )
}
