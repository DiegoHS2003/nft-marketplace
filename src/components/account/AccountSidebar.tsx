import { Link, useRouterState } from '@tanstack/react-router'

// Itens do Figma sem funcionalidade especificada no enunciado: mesmo tratamento do header
// (Mercado/Criadores/Aprenda) — link real para a página "fora do escopo", nunca um <span> morto.
const OUT_OF_SCOPE = ['Atividade', 'Lista de interesse', 'Ofertas', 'Arquivos baixados', 'Suporte']

export function AccountSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const itemClass = (active: boolean) =>
    `whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
      active ? 'bg-kurio-card font-bold text-kurio-text-accent' : 'text-kurio-text-secondary hover:text-kurio-text'
    }`

  return (
    <nav aria-label="Navegação da conta" className="shrink-0 md:w-56">
      <h2 className="mb-2 hidden text-sm font-bold uppercase tracking-wide text-kurio-text-secondary md:block">
        Meu perfil
      </h2>
      <ul className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0">
        <li>
          <Link to="/conta" className={itemClass(pathname === '/conta')}>
            Dados do perfil
          </Link>
        </li>
        <li>
          <Link to="/carteiras" className={itemClass(pathname === '/carteiras')}>
            Carteiras
          </Link>
        </li>
        {OUT_OF_SCOPE.map((label) => (
          <li key={label}>
            <Link to="/fora-do-escopo" search={{ secao: label }} className={itemClass(false)}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
