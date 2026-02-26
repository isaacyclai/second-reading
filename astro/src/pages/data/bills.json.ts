import type { APIRoute } from "astro";
import { getBillCount, getBills } from "../../lib/db";
import type { ListItem } from "../../lib/types";

interface DataResponse {
  items: ListItem[];
  total: number;
}

export const GET: APIRoute = () => {
  const items: ListItem[] = getBills().map((b) => ({
    id: b.id,
    title: b.title,
    date: b.firstReadingDate || undefined,
    ministry: b.ministry || undefined,
    firstReadingDate: b.firstReadingDate || undefined,
    hasSecondReading: b.hasSecondReading || false,
  }));

  const payload: DataResponse = {
    items,
    total: getBillCount(),
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};
