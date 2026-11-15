import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Il parametro dice al service worker di svuotare la cache delle pagine.
  return NextResponse.redirect(`${request.nextUrl.origin}/login?signedout=1`, { status: 303 });
}
