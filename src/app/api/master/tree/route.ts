import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { getCachedMasterTree } from "@/lib/queries/master";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const includeInactive =
    request.nextUrl.searchParams.get("includeInactive") === "true" &&
    auth.user.role === "admin";
  const includeParts = request.nextUrl.searchParams.get("includeParts") !== "false";

  const tree = await getCachedMasterTree({
    includeInactive,
    includeParts,
  });

  return NextResponse.json(tree, {
    headers: {
      "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
    },
  });
}
