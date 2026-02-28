import type { Metadata } from "next";
import { Geist, Geist_Mono, Poppins, Open_Sans } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import "../globals.css";
import { Providers } from "./providers";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { locales } from '@/i18n/routing';

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

const poppins = Poppins({
    variable: "--font-heading",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
});

const openSans = Open_Sans({
    variable: "--font-body",
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700"],
});

type SupportedLocale = (typeof locales)[number]

const BASE_URL = 'https://buildvideo.ai'

// 动态元数据生成
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'layout' })
    const localePath = `${BASE_URL}/${locale}`

    return {
        title: {
            default: t('title'),
            template: `%s | BuildVideo`,
        },
        description: t('description'),
        metadataBase: new URL(BASE_URL),
        alternates: {
            canonical: localePath,
            languages: {
                'zh': `${BASE_URL}/zh`,
                'en': `${BASE_URL}/en`,
            },
        },
        openGraph: {
            title: t('title'),
            description: t('description'),
            url: localePath,
            siteName: 'BuildVideo',
            locale: locale === 'zh' ? 'zh_CN' : 'en_US',
            type: 'website',
            images: [
                {
                    url: `${BASE_URL}/banner.png`,
                    width: 1200,
                    height: 630,
                    alt: 'BuildVideo - AI Video Production Platform',
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: t('title'),
            description: t('description'),
            images: [`${BASE_URL}/banner.png`],
        },
        icons: {
            icon: '/logo.ico?v=2',
            shortcut: '/logo.ico?v=2',
            apple: '/logo.png?v=2',
        },
        robots: {
            index: true,
            follow: true,
        },
    };
}

export function generateStaticParams() {
    return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    // 验证 locale 是否有效
    if (!locales.includes(locale as SupportedLocale)) {
        notFound();
    }

    // 获取翻译消息
    const messages = await getMessages();

    return (
        <html lang={locale}>
            <body
                className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} ${openSans.variable} antialiased`}
            >
                <NextIntlClientProvider messages={messages}>
                    <Providers>
                        {children}
                    </Providers>
                </NextIntlClientProvider>
                <SpeedInsights />
            </body>
        </html>
    );
}
