export default function FastSignLoading() {
  return (
    <div className="flex h-screen items-center justify-center" style={{ backgroundColor: "#F8F9FB" }}>
      <div className="text-center">
        <svg className="animate-spin h-12 w-12 text-blue-500 mb-4 mx-auto" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p className="text-lg font-medium text-gray-900 mb-2">Cargando Fast Sign...</p>
        <p className="text-sm text-gray-500">Por favor espera mientras preparamos tu espacio de trabajo</p>
      </div>
    </div>
  )
}
