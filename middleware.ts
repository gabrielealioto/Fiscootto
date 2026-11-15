import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Esclusi: asset statici, file della PWA e immagini.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|offline.html|manifest.webmanifest|icons/).*)"],
};
