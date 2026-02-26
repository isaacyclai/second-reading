import type { APIRoute } from "astro";
import { getQuestionCount, getQuestions } from "../../lib/db";
import type { ListItem } from "../../lib/types";

interface DataResponse {
  items: ListItem[];
  total: number;
}

export const GET: APIRoute = () => {
  const items: ListItem[] = getQuestions().map((q) => ({
    id: q.id,
    title: q.sectionTitle,
    date: q.sittingDate,
    type: q.sectionType,
    category: q.category || undefined,
    ministry: q.ministry || undefined,
    speakers: q.speakers?.map((s) => s.name) || [],
    snippet: q.contentPlain?.substring(0, 150),
  }));

  const payload: DataResponse = {
    items,
    total: getQuestionCount(),
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};
