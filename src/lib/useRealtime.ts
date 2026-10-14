import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { connectRealtime } from '@/lib/realtime'
import { useUser } from '@/lib/auth'

export function useRealtime() {
  const qc = useQueryClient()
  const user = useUser()
  const [notice, setNotice] = useState('')

  // reconecta quando o usuário muda: a conexão antiga é encerrada e a nova usa o token novo
  useEffect(() => {
    setNotice('')
    return connectRealtime(qc, localStorage.getItem('kurio:token'), setNotice)
  }, [qc, user?.id])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 8000)
    return () => clearTimeout(timer)
  }, [notice])

  return notice
}