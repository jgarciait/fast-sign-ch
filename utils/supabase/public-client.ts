import { createBrowserClient } from "@supabase/ssr"

export function createPublicClient() {
  // Use environment variables that are exposed to the client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables")
    // Return a mock client that won't throw errors when methods are called
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => ({ data: null, error: { message: "Missing Supabase environment variables" } }),
            limit: () => ({ data: null, error: { message: "Missing Supabase environment variables" } }),
          }),
          order: () => ({ data: null, error: { message: "Missing Supabase environment variables" } }),
        }),
        insert: () => ({ data: null, error: { message: "Missing Supabase environment variables" } }),
        update: () => ({ data: null, error: { message: "Missing Supabase environment variables" } }),
        delete: () => ({ data: null, error: { message: "Missing Supabase environment variables" } }),
      }),
      storage: {
        from: () => ({
          getPublicUrl: () => ({ data: { publicUrl: "" } }),
          upload: () => ({ data: null, error: { message: "Missing Supabase environment variables" } }),
          remove: () => ({ data: null, error: { message: "Missing Supabase environment variables" } }),
        }),
      },
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        signInWithPassword: () =>
          Promise.resolve({ data: { user: null }, error: { message: "Missing Supabase environment variables" } }),
        signUp: () =>
          Promise.resolve({ data: { user: null }, error: { message: "Missing Supabase environment variables" } }),
        signOut: () => Promise.resolve({ error: null }),
      },
    } as any
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
