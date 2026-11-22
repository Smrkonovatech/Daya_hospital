import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { providerRegistry } from "@/lib/providers/provider-registry";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

  const session = await verifySessionToken(token || bearerToken);
  if (!session && process.env.NODE_ENV !== "test") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const provider = (searchParams.get("provider") || "ALL").toUpperCase();
  const refresh = searchParams.get("refresh") === "true";

  try {
    const exotelProv = providerRegistry.getTelephonyProvider("EXOTEL");
    const sarvamProv = providerRegistry.getAiProvider("SARVAM_AI");

    const exotelCaps = exotelProv.getCapabilities();
    const sarvamCaps = await sarvamProv.getCapabilities(refresh);

    if (provider === "EXOTEL") {
      return NextResponse.json({ success: true, data: exotelCaps });
    }

    if (provider === "SARVAM" || provider === "SARVAM_AI") {
      return NextResponse.json({ success: true, data: sarvamCaps });
    }

    return NextResponse.json({
      success: true,
      data: {
        telephony: exotelCaps,
        ai: sarvamCaps,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load provider capabilities" },
      { status: 500 }
    );
  }
}
