import { Link, useRouterState } from '@tanstack/react-router'
import {
  CircleAlert, Download, MapPin, ShoppingBag, Tag, User, Heart,
} from 'lucide-react'

// Itens do Figma sem funcionalidade especificada no enunciado: mesmo tratamento do header
// (Mercado/Criadores/Aprenda) — link real para a página "fora do escopo", nunca um <span> morto.
const OUT_OF_SCOPE = [
  ['Atividade', ShoppingBag],
  ['Lista de interesse', Heart],
  ['Ofertas', Tag],
  ['Arquivos baixados', Download],
  ['Suporte', CircleAlert],
] as const

export function AccountSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const itemClass = (active: boolean) =>
    `flex items-center gap-2 whitespace-nowrap rounded-lg border-l-2 px-3 py-2 text-sm transition-colors ${
      active
        ? 'border-kurio-primary bg-kurio-card font-bold text-kurio-text-accent'
        : 'border-transparent text-kurio-text-secondary hover:text-kurio-text'
    }`

  return (
    <nav aria-label="Navegação da conta" className="shrink-0 md:w-56">
      <h2 className="mb-2 hidden text-lg font-bold text-kurio-text md:block">
        Meu perfil
      </h2>
      <ul className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0">
        <li>
          <Link to="/conta" className={itemClass(pathname === '/conta')}>
            <User aria-hidden="true" className="size-4 shrink-0" />
            Dados do perfil
          </Link>
        </li>
        <li>
          <Link to="/carteiras" className={itemClass(pathname === '/carteiras')}>
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            Carteiras
          </Link>
        </li>
        {OUT_OF_SCOPE.map(([label, Icon]) => (
          <li key={label}>
            <Link to="/fora-do-escopo" search={{ secao: label }} className={itemClass(false)}>
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
