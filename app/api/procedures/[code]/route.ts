import { NextResponse } from "next/server";
import { getProcedure, listProcedureCodes } from "@/lib/data/procedures";

/**
 * Source 1 — Procedure JSON API.
 *
 * GET /api/procedures/MRI_KNEE
 *
 * This is a real HTTP endpoint the agent consumes as an external data source
 * (it issues an actual fetch against it), mirroring how it would call a payer
 * charge-master or EHR procedure service in production.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const procedure = getProcedure(code);

  if (!procedure) {
    return NextResponse.json(
      {
        error: "procedure_not_found",
        message: `No procedure found for code "${code}".`,
        availableCodes: listProcedureCodes(),
      },
      { status: 404 },
    );
  }

  return NextResponse.json(procedure, {
    headers: { "Cache-Control": "no-store" },
  });
}
