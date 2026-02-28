'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import { AppIcon, type AppIconName } from '@/components/ui/icons'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'BuildVideo',
  description: 'AI-powered video production platform for creating professional anime and video content. Automated script analysis, storyboard generation, character design, voice synthesis, and video production.',
  url: 'https://buildvideo.ai',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
}

const featureIcons: Record<string, AppIconName> = {
  script: 'fileText',
  character: 'userCircle',
  storyboard: 'film',
  world: 'globe',
  voice: 'mic',
  video: 'video',
}

const powerIcons: Record<string, AppIconName> = {
  agents: 'cpu',
  prompts: 'fileText',
  providers: 'cube',
  queues: 'bolt',
}

const providerIcons: Record<string, AppIconName> = {
  image: 'image',
  video: 'clapperboard',
  voice: 'audioWave',
  llm: 'brain',
}

const selfhostIcons: AppIconName[] = ['globe', 'lock', 'bolt', 'diamond']

export default function Home() {
  const t = useTranslations('landing')
  const { data: session } = useSession()
  const features = ['script', 'character', 'storyboard', 'world', 'voice', 'video'] as const
  const powerItems = ['agents', 'prompts', 'providers', 'queues'] as const
  const providerCategories = ['image', 'video', 'voice', 'llm'] as const

  return (
    <div className="glass-page min-h-screen overflow-hidden font-sans selection:bg-[var(--glass-tone-info-bg)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="relative z-50">
        <Navbar />
      </div>

      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_80%_-10%,rgba(138,170,255,0.12),transparent),radial-gradient(900px_500px_at_0%_100%,rgba(148,163,184,0.16),transparent)]"></div>
      </div>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center -mt-16 px-4">
          <div className="container mx-auto grid lg:grid-cols-2 gap-16 items-center">
            <div className="text-left space-y-8 animate-slide-up" style={{ animationDuration: '0.8s' }}>
              <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-[var(--glass-tone-info-bg)] text-[var(--glass-tone-info-fg)] border border-[var(--glass-stroke-soft)]">
                  <AppIcon name="sparkles" className="w-4 h-4" />
                  {t('heroBadge')}
                </span>
              </div>

              <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <span className="block text-[var(--glass-text-primary)]">
                  {t('title')}
                </span>
                <span className="text-[var(--glass-tone-info-fg)]">
                  {t('subtitle')}
                </span>
              </h1>

              <p className="text-lg md:text-xl text-[var(--glass-text-secondary)] max-w-lg animate-fade-in" style={{ animationDelay: '0.4s' }}>
                {t('heroDescription')}
              </p>

              <div className="flex flex-wrap gap-4 pt-4 animate-fade-in" style={{ animationDelay: '0.6s' }}>
                {session ? (
                  <Link
                    href="/workspace"
                    className="glass-btn-base glass-btn-primary px-8 py-4 rounded-xl font-semibold transition-all duration-300"
                  >
                    {t('enterWorkspace')}
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/auth/signup"
                      className="glass-btn-base glass-btn-primary px-8 py-4 rounded-xl font-semibold transition-all duration-300"
                    >
                      {t('getStarted')}
                    </Link>
                    <a
                      href="#features"
                      className="glass-btn-base px-8 py-4 rounded-xl font-semibold transition-all duration-300 border border-[var(--glass-stroke-base)] text-[var(--glass-text-secondary)] hover:text-[var(--glass-text-primary)]"
                    >
                      {t('learnMore')}
                    </a>
                  </>
                )}
              </div>
            </div>

            <div className="relative h-[600px] hidden lg:flex items-center justify-center animate-scale-in" style={{ animationDuration: '1s' }}>
              <div className="relative w-full max-w-md aspect-square">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(circle,rgba(148,163,184,0.2),transparent_65%)] rounded-full blur-3xl opacity-70"></div>
                <div className="absolute top-0 right-10 w-64 h-80 glass-surface rounded-3xl transform rotate-6 animate-float-delayed"></div>
                <div className="absolute bottom-10 left-10 w-72 h-80 glass-surface-soft rounded-3xl transform -rotate-3 animate-float-slow"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-96 glass-surface-modal rounded-3xl overflow-hidden animate-float">
                  <div className="p-6 h-full flex flex-col">
                    <div className="w-full h-48 bg-[var(--glass-bg-muted)] rounded-2xl mb-6 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-[var(--glass-tone-info-bg)]/20 group-hover:bg-[var(--glass-tone-info-bg)]/35 transition-colors"></div>
                      <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--glass-bg-surface)]"></div>
                      <div className="absolute bottom-4 left-4 w-12 h-12 rounded-lg bg-[var(--glass-bg-surface-strong)] rotate-12"></div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-3 w-3/4 bg-[var(--glass-bg-muted)] rounded-full"></div>
                      <div className="h-3 w-1/2 bg-[var(--glass-bg-muted)] rounded-full"></div>
                      <div className="pt-4 flex gap-2">
                        <div className="h-10 w-10 rounded-full bg-[var(--glass-bg-surface)] border border-[var(--glass-stroke-soft)]"></div>
                        <div className="h-10 flex-1 rounded-full bg-[var(--glass-tone-info-bg)]/40 border border-[var(--glass-stroke-base)]"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Power Stats Section */}
        <section className="py-20 px-4 border-y border-[var(--glass-stroke-soft)]">
          <div className="container mx-auto">
            <div className="text-center mb-12 space-y-4">
              <h2 className="text-3xl md:text-5xl font-bold text-[var(--glass-text-primary)]">
                {t('power.title')}
              </h2>
              <p className="text-lg text-[var(--glass-text-secondary)] max-w-2xl mx-auto">
                {t('power.subtitle')}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {powerItems.map((key) => (
                <div key={key} className="glass-surface rounded-2xl p-8 text-center space-y-3 transition-all duration-300 hover:scale-[1.03]">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--glass-tone-info-bg)] text-[var(--glass-tone-info-fg)] flex items-center justify-center">
                    <AppIcon name={powerIcons[key]} className="w-6 h-6" />
                  </div>
                  <p className="text-4xl md:text-5xl font-bold text-[var(--glass-tone-info-fg)]">
                    {t(`power.items.${key}.number`)}
                  </p>
                  <p className="text-base font-semibold text-[var(--glass-text-primary)]">
                    {t(`power.items.${key}.label`)}
                  </p>
                  <p className="text-sm text-[var(--glass-text-secondary)]">
                    {t(`power.items.${key}.desc`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 px-4">
          <div className="container mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-5xl font-bold text-[var(--glass-text-primary)]">
                {t('features.title')}
              </h2>
              <p className="text-lg text-[var(--glass-text-secondary)] max-w-2xl mx-auto">
                {t('features.subtitle')}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((key) => (
                <div
                  key={key}
                  className="glass-surface rounded-2xl p-8 space-y-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                >
                  <div className="w-14 h-14 rounded-xl bg-[var(--glass-tone-info-bg)] text-[var(--glass-tone-info-fg)] flex items-center justify-center">
                    <AppIcon name={featureIcons[key]} className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-semibold text-[var(--glass-text-primary)]">
                    {t(`features.${key}.title`)}
                  </h3>
                  <p className="text-[var(--glass-text-secondary)] leading-relaxed">
                    {t(`features.${key}.description`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Providers Section */}
        <section className="py-24 px-4 border-t border-[var(--glass-stroke-soft)]">
          <div className="container mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-5xl font-bold text-[var(--glass-text-primary)]">
                {t('providers.title')}
              </h2>
              <p className="text-lg text-[var(--glass-text-secondary)] max-w-2xl mx-auto">
                {t('providers.subtitle')}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {providerCategories.map((key) => (
                <div key={key} className="glass-surface rounded-2xl p-6 flex items-start gap-4 transition-all duration-300 hover:scale-[1.01]">
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-[var(--glass-tone-info-bg)] text-[var(--glass-tone-info-fg)] flex items-center justify-center">
                    <AppIcon name={providerIcons[key]} className="w-6 h-6" />
                  </div>
                  <p className="text-[var(--glass-text-secondary)] leading-relaxed pt-2.5">
                    {t(`providers.${key}`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section className="py-24 px-4 border-t border-[var(--glass-stroke-soft)]">
          <div className="container mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-5xl font-bold text-[var(--glass-text-primary)]">
                {t('workflow.title')}
              </h2>
              <p className="text-lg text-[var(--glass-text-secondary)] max-w-2xl mx-auto">
                {t('workflow.subtitle')}
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-8 relative">
              {/* Connector line */}
              <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 bg-[var(--glass-stroke-base)]"></div>

              {([1, 2, 3, 4] as const).map((step) => (
                <div key={step} className="text-center space-y-4 relative">
                  <div className="w-24 h-24 mx-auto rounded-full glass-surface-modal flex items-center justify-center relative z-10">
                    <span className="text-3xl font-bold text-[var(--glass-tone-info-fg)]">{step}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--glass-text-primary)]">
                    {t(`workflow.step${step}.title`)}
                  </h3>
                  <p className="text-sm text-[var(--glass-text-secondary)]">
                    {t(`workflow.step${step}.description`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Self-Host Section */}
        <section className="py-24 px-4 border-t border-[var(--glass-stroke-soft)]">
          <div className="container mx-auto">
            <div className="glass-surface-modal rounded-3xl p-12 md:p-16 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(800px_400px_at_20%_80%,rgba(99,102,241,0.08),transparent)]"></div>
              <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <h2 className="text-3xl md:text-4xl font-bold text-[var(--glass-text-primary)]">
                    {t('selfhost.title')}
                  </h2>
                  <p className="text-lg text-[var(--glass-text-secondary)] leading-relaxed">
                    {t('selfhost.subtitle')}
                  </p>
                  <div className="glass-surface rounded-xl p-4 font-mono text-sm text-[var(--glass-tone-info-fg)] flex items-center gap-3">
                    <span className="text-[var(--glass-text-tertiary)]">$</span>
                    <code>{t('selfhost.docker')}</code>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {([1, 2, 3, 4] as const).map((n, i) => (
                    <div key={n} className="glass-surface rounded-xl p-5 space-y-2 text-center">
                      <div className="w-10 h-10 mx-auto rounded-lg bg-[var(--glass-tone-info-bg)] text-[var(--glass-tone-info-fg)] flex items-center justify-center">
                        <AppIcon name={selfhostIcons[i]} className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-[var(--glass-text-primary)]">
                        {t(`selfhost.feature${n}`)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-4">
          <div className="container mx-auto">
            <div className="glass-surface-modal rounded-3xl p-12 md:p-16 text-center space-y-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(600px_300px_at_50%_0%,rgba(99,102,241,0.1),transparent)]"></div>
              <div className="relative z-10 space-y-6">
                <h2 className="text-3xl md:text-5xl font-bold text-[var(--glass-text-primary)]">
                  {t('cta.title')}
                </h2>
                <p className="text-lg text-[var(--glass-text-secondary)] max-w-xl mx-auto">
                  {t('cta.subtitle')}
                </p>
                <div className="flex flex-wrap justify-center gap-4 pt-4">
                  <Link
                    href={session ? '/workspace' : '/auth/signup'}
                    className="glass-btn-base glass-btn-primary px-10 py-4 rounded-xl font-semibold text-lg transition-all duration-300 inline-block"
                  >
                    {t('cta.button')}
                  </Link>
                  <a
                    href="https://github.com/BuildVideoAI/buildvideo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-btn-base px-10 py-4 rounded-xl font-semibold text-lg transition-all duration-300 inline-flex items-center gap-2 border border-[var(--glass-stroke-base)] text-[var(--glass-text-secondary)] hover:text-[var(--glass-text-primary)]"
                  >
                    <AppIcon name="externalLink" className="w-5 h-5" />
                    {t('cta.github')}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 border-t border-[var(--glass-stroke-soft)]">
          <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[var(--glass-text-tertiary)]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--glass-text-secondary)]">BuildVideo</span>
              <span>—</span>
              <span>{t('footer.description')}</span>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="https://github.com/BuildVideoAI/buildvideo"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--glass-text-primary)] transition-colors"
              >
                {t('footer.github')}
              </a>
              <span>&copy; {t('footer.copyright')}</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
