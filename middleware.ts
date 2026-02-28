import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // Skip i18n middleware for SEO files served from app root
    if (pathname === '/sitemap.xml' || pathname === '/robots.txt' || pathname === '/manifest.json') {
        return NextResponse.next();
    }

    return intlMiddleware(request);
}

export const config = {
    matcher: [
        '/((?!api|m|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.gif|.*\\.ico).*)'
    ]
};
