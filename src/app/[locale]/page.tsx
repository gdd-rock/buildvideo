'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'

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

const featureIcons: Record<string, string> = {
  script: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  character: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  storyboard: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm10 0a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z',
  world: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  voice: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  video: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
}

function FeatureIcon({ path }: { path: string }) {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}

export default function Home() {
  const t = useTranslations('landing')
  const { data: session } = useSession()
  const features = ['script', 'character', 'storyboard', 'world', 'voice', 'video'] as const

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

        {/* Stats Bar */}
        <section className="py-12 border-y border-[var(--glass-stroke-soft)]">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {(['providers', 'videoProviders', 'languages', 'openSource'] as const).map((key) => (
                <div key={key} className="space-y-1">
                  <p className="text-lg md:text-xl font-semibold text-[var(--glass-text-primary)]">{t(`stats.${key}`)}</p>
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
                    <FeatureIcon path={featureIcons[key]} />
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
                <div className="pt-4">
                  <Link
                    href={session ? '/workspace' : '/auth/signup'}
                    className="glass-btn-base glass-btn-primary px-10 py-4 rounded-xl font-semibold text-lg transition-all duration-300 inline-block"
                  >
                    {t('cta.button')}
                  </Link>
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
