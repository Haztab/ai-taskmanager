import { NextRequest, NextResponse } from "next/server";
import { evaluate, CalculationError } from "@/lib/calculation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { expression } = body;

    if (typeof expression !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'expression' field" },
        { status: 400 }
      );
    }

    const result = evaluate(expression);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CalculationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
