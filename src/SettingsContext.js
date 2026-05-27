import { createContext, useContext } from 'react'

export const SettingsContext = createContext({
  paymentUrl:  '',
  paymentName: '',
})

export const useSettings = () => useContext(SettingsContext)
