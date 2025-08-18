import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import SignupForm from "@/components/signup-form"
import { Logo } from "@/components/logo"

export default async function Signup() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/fast-sign")
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
          <h1 className="text-3xl font-bold text-center mb-4">Welcome to AQSign</h1>
          <p className="text-center mb-12">The secure and efficient way to sign and manage your documents</p>

          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="bg-[#1a3a5f] p-6 rounded-lg">
              <div className="flex items-center mb-2">
                <div className="mr-2">🔒</div>
                <h3 className="font-semibold">Secure Signing</h3>
              </div>
              <p className="text-sm">End-to-end encryption for all your documents</p>
            </div>

            <div className="bg-[#1a3a5f] p-6 rounded-lg">
              <div className="flex items-center mb-2">
                <div className="mr-2">🔄</div>
                <h3 className="font-semibold">Easy Sharing</h3>
              </div>
              <p className="text-sm">Share documents with clients in seconds</p>
            </div>

            <div className="bg-[#1a3a5f] p-6 rounded-lg">
              <div className="flex items-center mb-2">
                <div className="mr-2">📝</div>
                <h3 className="font-semibold">Legal Compliance</h3>
              </div>
              <p className="text-sm">Fully compliant with digital signature laws</p>
            </div>

            <div className="bg-[#1a3a5f] p-6 rounded-lg">
              <div className="flex items-center mb-2">
                <div className="mr-2">☁️</div>
                <h3 className="font-semibold">Cloud Storage</h3>
              </div>
              <p className="text-sm">Access your documents from anywhere</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Signup form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold mb-2">Create an account</h2>
          <p className="text-gray-600 mb-8">Sign up to start using AQSign</p>

          <SignupForm />

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{" "}
              <Link href="/" className="text-blue-600 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
