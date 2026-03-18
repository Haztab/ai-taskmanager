"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface IdeaCardProps {
  idea: {
    id: string;
    title: string;
    description: string;
    category: string | null;
    isPromoted: boolean;
  };
  onPromote?: (id: string) => void;
  isPromoting?: boolean;
}

export function IdeaCard({ idea, onPromote, isPromoting }: IdeaCardProps) {
  return (
    <Card className={idea.isPromoted ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{idea.title}</CardTitle>
          {idea.category && (
            <Badge variant="secondary" className="shrink-0">
              {idea.category}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">{idea.description}</p>
        {!idea.isPromoted && onPromote && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPromote(idea.id)}
            disabled={isPromoting}
          >
            {isPromoting ? "Promoting..." : "Promote to Epic"}
          </Button>
        )}
        {idea.isPromoted && (
          <Badge variant="default" className="bg-green-600">
            Promoted
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
