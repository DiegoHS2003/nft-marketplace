// window.history.length conta a aba em branco inicial do navegador, então não dá pra confiar nele
// pra saber se "voltar" leva a uma página de verdade do app. Em vez disso, contamos quantas
// localizações o roteador já resolveu nesta sessão: se só vimos uma (a atual), não tem pra onde voltar.
let locationsSeen = 0

export function markLocationSeen() {
  locationsSeen++
}

export function hasPreviousPage() {
  return locationsSeen > 1
}
