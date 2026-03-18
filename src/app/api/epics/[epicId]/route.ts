import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ epicId: string }> }
) {
  try {
    const { epicId } = await params;
    const epic = await prisma.epic.findUnique({
      where: { id: epicId },
      include: {
        tasks: {
          orderBy: { sortOrder: "asc" },
          include: { workstream: true },
        },
      },
    });

    if (!epic) {
      return NextResponse.json({ error: "Epic not found" }, { status: 404 });
    }

    return NextResponse.json(epic);
  } catch (error) {
    console.error("Failed to fetch epic:", error);
    return NextResponse.json(
      { error: "Failed to fetch epic" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ epicId: string }> }
) {
  try {
    const { epicId } = await params;
    const body = await request.json();
    const { title, description } = body;

    const epic = await prisma.epic.update({
      where: { id: epicId },
      data: { title, description },
    });

    return NextResponse.json(epic);
  } catch (error) {
    console.error("Failed to update epic:", error);
    return NextResponse.json(
      { error: "Failed to update epic" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ epicId: string }> }
) {
  try {
    const { epicId } = await params;
    await prisma.epic.delete({
      where: { id: epicId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete epic:", error);
    return NextResponse.json(
      { error: "Failed to delete epic" },
      { status: 500 }
    );
  }
}
