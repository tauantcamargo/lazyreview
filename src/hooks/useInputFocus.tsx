import React, { createContext, useContext, useState, useCallback } from 'react'

interface InputFocusContextType {
  readonly isInputActive: boolean
  readonly setInputActive: (active: boolean) => void
}

const InputFocusContext = createContext<InputFocusContextType>({
  isInputActive: false,
  setInputActive: () => {},
})

interface InputFocusProviderProps {
  readonly children: React.ReactNode
}

export function InputFocusProvider({
  children,
}: InputFocusProviderProps): React.ReactElement {
  const [isInputActive, setIsInputActive] = useState(false)

  const setInputActive = useCallback((active: boolean) => {
    setIsInputActive(active)
  }, [])

  return React.createElement(
    InputFocusContext.Provider,
    { value: { isInputActive, setInputActive } },
    children,
  )
}

export function useInputFocus(): InputFocusContextType {
  return useContext(InputFocusContext)
}
