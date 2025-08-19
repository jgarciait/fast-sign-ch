import { createClient } from "@/utils/supabase/server"
import { getChoferes } from "@/app/actions/chofer-actions"
import ChoferesList from "@/components/choferes-list"

export default async function ChoferesPage() {
  const supabase = await createClient()
  const { data: choferes, error, total } = await getChoferes()

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Choferes</h1>
      </div>

      <ChoferesList 
        initialChoferes={choferes || []} 
        initialTotal={total || 0}
        initialError={error || undefined}
      />
    </div>
  )
}
