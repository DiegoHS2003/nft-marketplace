import { useEffect, useState } from 'react'
import { useReducedMotion } from '@/lib/useReducedMotion'

const SLIDES = [
  {
    eyebrow: 'Bem-vindo à Kurio',
    title: 'Seja dono do futuro da arte digital',
    text: 'Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura do amanhã.',
    image: '/nfts/macaco-1.png',
    alt: 'Macaco de óculos e jaqueta verde, NFT em destaque',
  },
  {
    eyebrow: 'Bem-vindo à Kurio',
    title: 'Seja dono da cultura digital',
    text: 'Descubra NFTs selecionados de criadores do mundo todo.',
    image: '/nfts/macaco-2.png',
    alt: 'Macaco com chapéu e moletom, NFT em destaque',
  },
  {
    eyebrow: 'Bem-vindo à Kurio',
    title: 'Colecione peças exclusivas e numeradas',
    text: 'Edições limitadas, com procedência registrada e verificada na rede.',
    image: '/nfts/macaco-3.png',
    alt: 'Macaco de gola alta, NFT em destaque',
  },
] as const

const AUTOPLAY_MS = 6000

export function HeroCarousel() {
  const [index, setIndex] = useState(0)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (reducedMotion) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [reducedMotion])

  const slide = SLIDES[index]

  return (
    <section className="border-b border-kurio-border bg-kurio-ink-soft" aria-roledescription="carrossel" aria-label="Destaques">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 md:grid-cols-2">
        <div>
          <p className="text-sm text-kurio-text-accent">{slide.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold uppercase leading-tight text-kurio-foreground sm:text-4xl lg:text-5xl">
            {slide.title}
          </h1>
          <p className="mt-4 max-w-md text-sm text-kurio-text-secondary">{slide.text}</p>
          <a
            href="#catalogo"
            className="mt-6 inline-block rounded bg-kurio-primary px-5 py-2 text-sm font-bold uppercase text-kurio-ink hover:bg-kurio-primary-light"
          >
            Explorar
          </a>
        </div>
        <img
          key={slide.image}
          src={slide.image}
          alt={slide.alt}
          className="aspect-square w-full max-w-md justify-self-center rounded-2xl object-cover md:justify-self-end"
        />
      </div>

      <div role="tablist" aria-label="Selecionar destaque" className="flex items-center justify-center gap-2 pb-6">
        {SLIDES.map((s, i) => (
          <button
            key={s.image}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Destaque ${i + 1} de ${SLIDES.length}`}
            onClick={() => setIndex(i)}
            className={`size-2 rounded-full transition-colors motion-reduce:transition-none ${
              i === index ? 'bg-kurio-primary' : 'bg-kurio-border-soft'
            }`}
          />
        ))}
      </div>
    </section>
  )
}
