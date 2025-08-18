"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import type { User } from "@supabase/supabase-js"

export default function Header({ user }: { user: User }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <header className="border-b" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/fast-sign">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Fn6PEYeSq1KNcaKOgef8CSVBM4XaZr.png"
                  alt="AQSign Logo"
                  width={40}
                  height={40}
                />
              </Link>
            </div>
          </div>

          <div className="flex items-center">
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0d2340]"
              >
                <span className="sr-only">Open user menu</span>
                <div 
                  className="h-8 w-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#F1F3F7', color: '#282828' }}
                >
                  {user.email?.charAt(0).toUpperCase()}
                </div>
              </button>

              {isMenuOpen && (
                <div 
                  className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 ring-1 ring-opacity-5 focus:outline-none z-10"
                  style={{ 
                    backgroundColor: '#FFFFFF', // --surface
                    borderColor: '#E5E7EB'
                  }}
                >
                  <div className="px-4 py-2 text-xs" style={{ color: '#282828' }}>{user.email}</div>
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm hover:opacity-80 transition-colors"
                    style={{ color: '#282828' }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
