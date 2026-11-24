import { type NextRequest, NextResponse } from "next/server";
import { LANGUAGE_COOKIE, prefersArabic } from "@/site/language";

// The public site's English pages send a visitor who reads Arabic to the same page under /ar: the
// language they picked in the footer (a cookie) if they have, else their browser's. The Arabic pages
// are never redirected, so a shared /ar link always opens in Arabic.
export function proxy(request: NextRequest) {
  const picked = request.cookies.get(LANGUAGE_COOKIE)?.value;
  const arabic = picked ? picked === "ar" : prefersArabic(request.headers.get("accept-language"));
  if (!arabic) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/ar${url.pathname}`;
  const response = NextResponse.redirect(url);
  response.headers.set("Vary", "Accept-Language, Cookie");
  return response;
}

// Only the site's English pages (the venue page, a booking's share link and the staff link
// fallback): never the admin or assets. A /booking or /manage link only gets here without the app,
// so redirecting it never reaches the app.
export const config = { matcher: ["/venue/:path*", "/booking/:path*", "/manage/:path*"] };
