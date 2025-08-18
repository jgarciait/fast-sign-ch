import { getCustomer, updateCustomer } from "@/app/actions/customer-actions"
import Link from "next/link"
import { redirect } from "next/navigation"
import { notFound } from "next/navigation"

export default async function EditCustomer({ params }: { params: { id: string } }) {
  const { customer, error } = await getCustomer(params.id)

  if (error) {
    notFound()
  }

  if (!customer) {
    notFound()
  }

  async function handleUpdateCustomer(formData: FormData) {
    "use server"
    
    const result = await updateCustomer(params.id, formData)
    
    if (result.error) {
      // In a real app, you'd handle this error better
      redirect(`/customers/${params.id}?error=${encodeURIComponent(result.error)}`)
    } else {
      redirect("/customers")
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center mb-6">
        <Link
          href="/customers"
          className="text-blue-600 hover:text-blue-800 mr-4"
        >
          ← Volver a Contactos
        </Link>
        <h1 className="text-2xl font-bold">Editar Contacto</h1>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <form action={handleUpdateCustomer} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-2">
                Nombre
              </label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                defaultValue={customer.first_name || ""}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ingresa el nombre"
              />
            </div>

            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-2">
                Apellido
              </label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                defaultValue={customer.last_name || ""}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ingresa el apellido"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Correo Electrónico <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              defaultValue={customer.email}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ingresa el correo electrónico"
            />
          </div>

          <div>
            <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-2">
              Número de Teléfono
            </label>
            <input
              type="tel"
              id="telephone"
              name="telephone"
              defaultValue={customer.telephone || ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ingresa el número de teléfono"
            />
          </div>

          <div>
            <label htmlFor="postal_address" className="block text-sm font-medium text-gray-700 mb-2">
              Dirección Postal
            </label>
            <textarea
              id="postal_address"
              name="postal_address"
              rows={3}
              defaultValue={customer.postal_address || ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ingresa la dirección postal"
            />
          </div>

          <div className="flex justify-end space-x-4">
            <Link
              href="/customers"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              className="px-4 py-2 bg-[#0d2340] text-white rounded-md hover:bg-[#1a3a5f] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Actualizar Contacto
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 