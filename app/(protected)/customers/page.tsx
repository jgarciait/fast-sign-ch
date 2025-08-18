import { createClient } from "@/utils/supabase/server"
import { getCustomers } from "@/app/actions/customer-actions"
import CustomersList from "@/components/customers-list"

export default async function Customers() {
  const supabase = await createClient()
  const { customers, error } = await getCustomers()

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Contactos</h1>
      </div>

      <CustomersList 
        initialCustomers={customers || []} 
        initialError={error || undefined}
      />
    </div>
  )
}
