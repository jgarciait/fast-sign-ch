import { Logo } from "@/components/logo"

export default function EnvironmentError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
        <div className="text-center mb-6">
          <Logo className="h-12 w-12 mx-auto mb-4" color="#0d2340" />
          <h1 className="text-2xl font-bold">Configuration Error</h1>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-6">
          <p className="font-medium">Missing Supabase environment variables</p>
          <p className="mt-2 text-sm">
            The application is missing required Supabase environment variables. Please contact the administrator to
            resolve this issue.
          </p>
        </div>
        <div className="text-gray-600 text-sm">
          <p className="mb-2">This error typically occurs when:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>The application has not been properly configured with Supabase credentials</li>
            <li>Environment variables are not being properly loaded</li>
            <li>There is an issue with the deployment configuration</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
