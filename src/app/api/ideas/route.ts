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

    const ideas = await prisma.idea.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        epic: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(ideas);
  } catch (error) {
    console.error("Failed to fetch ideas:", error);
    return NextResponse.json(
      { error: "Failed to fetch ideas" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, category, projectId } = body;

    if (!title || !description || !projectId) {
      return NextResponse.json(
        { error: "title, description, and projectId are required" },
        { status: 400 }
      );
    }

    const idea = await prisma.idea.create({
      data: { title, description, category, projectId },
    });

    return NextResponse.json(idea, { status: 201 });
  } catch (error) {
    console.error("Failed to create idea:", error);
    return NextResponse.json(
      { error: "Failed to create idea" },
      { status: 500 }
    );
  }
}
