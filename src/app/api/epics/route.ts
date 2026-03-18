import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const epics = await prisma.epic.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { tasks: true } },
      },
    });

    return NextResponse.json(epics);
  } catch (error) {
    console.error("Failed to fetch epics:", error);
    return NextResponse.json(
      { error: "Failed to fetch epics" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, projectId } = body;

    if (!title || !projectId) {
      return NextResponse.json(
        { error: "title and projectId are required" },
        { status: 400 }
      );
    }

    const epic = await prisma.epic.create({
      data: { title, description, projectId },
    });

    return NextResponse.json(epic, { status: 201 });
  } catch (error) {
    console.error("Failed to create epic:", error);
    return NextResponse.json(
      { error: "Failed to create epic" },
      { status: 500 }
    );
  }
}
