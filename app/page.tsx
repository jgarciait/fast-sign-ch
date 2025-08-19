import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import LoginForm from "@/components/login-form"
import { Logo } from "@/components/logo"

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/fast-sign-docs")
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Welcome section */}
      <div className="hidden md:flex md:w-1/2 bg-[#0d2340] text-white flex-col items-center justify-center p-8">
        <div className="max-w-md mx-auto flex flex-col items-center">
          <div className="mb-8">
            <div className="mx-auto">
              <Logo className="h-24 w-24" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center mb-4">Bienvenido a AQ Fast Sign V2.0</h1>
          <p className="text-center mb-12">Sistema de gestión de conduces y asignaciones para choferes</p>

          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="bg-[#1a3a5f] p-6 rounded-lg">
              <div className="flex items-center mb-2">
                <div className="mr-2">🔒</div>
                <h3 className="font-semibold">Firma Segura</h3>
              </div>
              <p className="text-sm">Cifrado de extremo a extremo para todos tus documentos</p>
            </div>

            <div className="bg-[#1a3a5f] p-6 rounded-lg">
              <div className="flex items-center mb-2">
                <div className="mr-2">🔄</div>
                <h3 className="font-semibold">Compartir Fácil</h3>
              </div>
              <p className="text-sm">Comparte documentos con clientes en segundos</p>
            </div>

            <div className="bg-[#1a3a5f] p-6 rounded-lg">
              <div className="flex items-center mb-2">
                <div className="mr-2">📝</div>
                <h3 className="font-semibold">Cumplimiento Legal</h3>
              </div>
              <p className="text-sm">Totalmente conforme con las leyes de firma digital</p>
            </div>

            <div className="bg-[#1a3a5f] p-6 rounded-lg">
              <div className="flex items-center mb-2">
                <div className="mr-2">☁️</div>
                <h3 className="font-semibold">Almacenamiento en la Nube</h3>
              </div>
              <p className="text-sm">Accede a tus documentos desde cualquier lugar</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Cardinal Health Logo */}
          <div className="flex justify-center mb-6">
            <img 
              src="/cardinal_logo.png" 
              alt="Cardinal Health Logo" 
              className="h-36 w-auto object-contain"
            />
          </div>
          <h2 className="text-2xl font-bold mb-2">Inicia sesión en tu cuenta</h2>
          <p className="text-gray-600 mb-8">Ingresa tus credenciales para acceder a tus documentos</p>

          <LoginForm />

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              ¿No tienes una cuenta?{" "}
              <Link href="/signup" className="text-blue-600 hover:underline">
                Crear una cuenta
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
