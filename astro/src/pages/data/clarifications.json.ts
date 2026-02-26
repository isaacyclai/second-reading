import type { APIRoute } from "astro";
import { getClarificationCount, getClarifications } from "../../lib/db";
import type { ListItem } from "../../lib/types";

interface DataResponse {
  items: ListItem[];
  total: number;
}

export const GET: APIRoute = () => {
  const items: ListItem[] = getClarifications().map((c) => ({
    id: c.id,
    title: c.sectionTitle,
    date: c.sittingDate,
    type: c.sectionType,
    category: c.category || undefined,
    ministry: c.ministry || undefined,
    speakers: c.speakers?.map((s) => s.name) || [],
    snippet: c.contentPlain?.substring(0, 150),
  }));

  const payload: DataResponse = {
    items,
    total: getClarificationCount(),
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};
