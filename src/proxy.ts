import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname, searchParams } = request.nextUrl;

  const protectedPaths = [
    '/home', '/profile', '/bubble', '/search',
    '/chat', '/notifications', '/settings',
    '/liked', '/saved', '/qrcode', '/onboarding',
  ];
  const isProtected = protectedPaths.some(path => pathname.startsWith(path));

  // 未認証 → /auth
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    return NextResponse.redirect(url);
  }

  // 認証済みで /auth → /home
  if (user && pathname === '/auth') {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return NextResponse.redirect(url);
  }

  // /onboarding: ?resume=true ならスキップ、それ以外は完了チェック
  if (user && pathname === '/onboarding' && searchParams.get('resume') !== 'true') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .single();

    if ((profile as { onboarding_completed?: boolean } | null)?.onboarding_completed === true) {
      const url = request.nextUrl.clone();
      url.pathname = '/home';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
