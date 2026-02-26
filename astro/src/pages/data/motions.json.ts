import type { APIRoute } from "astro";
import { getMotionCount, getMotions } from "../../lib/db";
import type { ListItem } from "../../lib/types";

interface DataResponse {
  items: ListItem[];
  total: number;
}

export const GET: APIRoute = () => {
  const items: ListItem[] = getMotions().map((m) => ({
    id: m.id,
    title: m.sectionTitle,
    date: m.sittingDate,
    type: m.sectionType,
    category: m.category || undefined,
    ministry: m.ministry || undefined,
    speakers: m.speakers?.map((s) => s.name) || [],
    snippet: m.contentPlain?.substring(0, 150),
  }));

  const payload: DataResponse = {
    items,
    total: getMotionCount(),
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};
