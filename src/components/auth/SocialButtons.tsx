export function SocialButtons() {
  return (
    <div className="mt-2">
      <p className="mb-2 text-center text-xs text-kurio-text-secondary">Ou continue com</p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Fora do escopo do desafio"
          className="flex items-center justify-center gap-2 rounded border border-kurio-border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continuar com Google
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Fora do escopo do desafio"
          className="flex items-center justify-center gap-2 rounded border border-kurio-border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continuar com Facebook
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-kurio-text-secondary">
        Login social e recuperação de senha estão fora do escopo do desafio.
      </p>
    </div>
  )
}
