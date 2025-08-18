export function Logo({ className = "h-8 w-8", color = "#FFFFFF" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" stroke={color} strokeWidth="2" fill="none" />
      <path d="M30 65C40 55 60 75 70 35" stroke={color} strokeWidth="3" fill="none" />
      <path d="M25 55C40 40 60 60 75 30" stroke={color} strokeWidth="3" fill="none" />
      <path d="M20 45C40 25 60 45 80 25" stroke={color} strokeWidth="3" fill="none" />
    </svg>
  )
}
