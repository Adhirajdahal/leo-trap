import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => req.cookies.get(n)?.value,
        set: (n, v, o) => res.cookies.set({ name: n, value: v, ...o }),
        remove: (n, o) => res.cookies.set({ name: n, value: '', ...o }),
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const guarded = path.startsWith('/lobby') || path.startsWith('/game') || path.startsWith('/admin');
  if (guarded && !user) return NextResponse.redirect(new URL('/', req.url));
  if (path === '/' && user) return NextResponse.redirect(new URL('/lobby', req.url));
  return res;
}

export const config = { matcher: ['/', '/lobby/:path*', '/game/:path*', '/admin/:path*'] };
