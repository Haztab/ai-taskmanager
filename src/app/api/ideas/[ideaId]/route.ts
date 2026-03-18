import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ ideaId: string }> }
) {
  try {
    const { ideaId } = await params;
    const body = await request.json();
    const { title, description, category, isPromoted, epicId } = body;

    const idea = await prisma.idea.update({
      where: { id: ideaId },
      data: { title, description, category, isPromoted, epicId },
    });

    return NextResponse.json(idea);
  } catch (error) {
    console.error("Failed to update idea:", error);
    return NextResponse.json(
      { error: "Failed to update idea" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ ideaId: string }> }
) {
  try {
    const { ideaId } = await params;
    await prisma.idea.delete({
      where: { id: ideaId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete idea:", error);
    return NextResponse.json(
      { error: "Failed to delete idea" },
      { status: 500 }
    );
  }
}
