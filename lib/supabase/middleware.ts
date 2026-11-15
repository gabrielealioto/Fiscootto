import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configErrorPage, missingEnv, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/auth"];

/** Rinnova la sessione a ogni richiesta e manda al login chi non è autenticato. */
export async function updateSession(request: NextRequest) {
  const missing = missingEnv();
  if (missing.length) {
    return new NextResponse(configErrorPage(missing), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Se Supabase non risponde, la pagina di login deve comunque aprirsi.
  let user = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (e) {
    console.error("Supabase non raggiungibile dal middleware:", e);
  }

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && !isPublic) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
