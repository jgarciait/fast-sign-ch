"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { type Customer, getCustomers, createCustomer } from "@/app/actions/customer-actions"
import { PlusCircle, X } from "lucide-react"

type CustomerSelectorProps = {
  value: string
  onChange: (value: string) => void
}

export default function CustomerSelector({ value, onChange }: CustomerSelectorProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    first_name: "",
    last_name: "",
    email: "",
    telephone: "",
    postal_address: "",
  })
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCustomers() {
      setLoading(true)
      setError(null)
      try {
        const result = await getCustomers()
        if (result.error) {
          setError(result.error)
        } else if (result.customers) {
          setCustomers(result.customers)
        }
      } catch (err) {
        setError("Failed to load customers")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadCustomers()
  }, [])

  const handleNewCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setNewCustomer((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingCustomer(true)
    setCreateError(null)

    try {
      const formData = new FormData()
      formData.append("first_name", newCustomer.first_name)
      formData.append("last_name", newCustomer.last_name)
      formData.append("email", newCustomer.email)
      formData.append("telephone", newCustomer.telephone)
      formData.append("postal_address", newCustomer.postal_address)

      const result = await createCustomer(formData)

      if (result.error) {
        setCreateError(result.error)
      } else if (result.customer) {
        // Add the new customer to the list
        setCustomers((prev) => [result.customer, ...prev])

        // Select the new customer
        onChange(result.customer.email)

        // Reset the form
        setNewCustomer({
          first_name: "",
          last_name: "",
          email: "",
          telephone: "",
          postal_address: "",
        })

        // Close the form
        setShowNewCustomerForm(false)
      }
    } catch (err) {
      setCreateError("Failed to create customer")
      console.error(err)
    } finally {
      setCreatingCustomer(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        {loading ? (
          <div className="text-center py-4">Cargando contactos...</div>
        ) : error ? (
          <div className="text-red-500 py-2">{error}</div>
        ) : customers.length === 0 ? (
          <div className="text-center py-4">
            <p className="mb-2">No se encontraron contactos existentes</p>
          </div>
        ) : (
          <>
            <label htmlFor="recipient" className="block text-sm font-medium text-gray-700 mb-1">
              Seleccionar contacto...
            </label>
            <select
              id="recipient"
              name="recipient"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Seleccionar un contacto
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.email}>
                  {customer.first_name} {customer.last_name} ({customer.email})
                </option>
              ))}
            </select>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowNewCustomerForm(true)}
                className="text-blue-600 hover:underline flex items-center text-sm"
              >
                <PlusCircle className="h-4 w-4 mr-1" /> Añadir contacto
              </button>
            </div>
          </>
        )}

        {showNewCustomerForm && (
          <div className="mt-4 border rounded-md p-4 bg-gray-50 relative">
            <button
              type="button"
              onClick={() => setShowNewCustomerForm(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-medium mb-3">Añadir Nuevo Contacto</h3>
            {createError && <div className="text-red-500 text-sm mb-3">{createError}</div>}
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={newCustomer.first_name}
                    onChange={handleNewCustomerChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Apellido
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={newCustomer.last_name}
                    onChange={handleNewCustomerChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Correo
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={newCustomer.email}
                  onChange={handleNewCustomerChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono (opcional)
                </label>
                <input
                  type="tel"
                  id="telephone"
                  name="telephone"
                  value={newCustomer.telephone}
                  onChange={handleNewCustomerChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="postal_address" className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección Postal (opcional)
                </label>
                <input
                  type="text"
                  id="postal_address"
                  name="postal_address"
                  value={newCustomer.postal_address}
                  onChange={handleNewCustomerChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={creatingCustomer}
                  className="bg-primary text-primary-foreground py-2 px-4 rounded-md text-sm hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors disabled:opacity-50"
                >
                  {creatingCustomer ? "Creando..." : "Crear Contacto"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
