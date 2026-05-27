import { createContext, useContext } from 'react'
export const LangContext = createContext({ t: k => k, lang: 'nl' })
export const useLang = () => useContext(LangContext)
