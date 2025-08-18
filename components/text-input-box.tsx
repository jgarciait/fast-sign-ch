"use client"

import type React from "react"

import { useState } from "react"

interface TextInputBoxProps {
  defaultValue?: string
  onChange: (value: string) => void
}

export default function TextInputBox({ defaultValue = "", onChange }: TextInputBoxProps) {
  const [value, setValue] = useState(defaultValue)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    onChange(e.target.value)
  }

  return (
    <textarea
      className="w-full h-full resize-none border-none focus:outline-none focus:ring-0 p-0"
      value={value}
      onChange={handleChange}
      placeholder="Type here..."
    />
  )
}
