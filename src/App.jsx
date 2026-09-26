import { useEffect, useState } from 'react'

export default function App() {
  const [status, setStatus] = useState('Menghubungkan ke server...')

  useEffect(() => {
    const controller = new AbortController()

    async function checkHealth() {
      try {
        const response = await fetch('/api/health', {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Health check failed')
        }

        const data = await response.json()
        setStatus(`Server aktif: ${data.status}`)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setStatus('Server tidak dapat dihubungi')
        }
      }
    }

    checkHealth()

    return () => controller.abort()
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <section className="text-center">
        <h1 className="text-3xl font-semibold">Demo EFISA</h1>
        <p className="mt-3 text-slate-400">React + Express dalam satu aplikasi</p>
        <p className="mt-6 text-sm text-emerald-400" aria-live="polite">
          {status}
        </p>
      </section>
    </main>
  )
}
