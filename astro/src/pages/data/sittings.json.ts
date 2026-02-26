import type { APIRoute } from "astro";
import { getSittingCount, getSittings } from "../../lib/db";
import type { ListItem } from "../../lib/types";

interface DataResponse {
  items: ListItem[];
  total: number;
}

export const GET: APIRoute = () => {
  const items: ListItem[] = getSittings().map((s) => ({
    id: s.id,
    date: s.date,
    parliament: s.parliament,
    sessionNo: s.sessionNo,
    sittingNo: s.sittingNo,
    sectionCount: s.sectionCount,
  }));

  const payload: DataResponse = {
    items,
    total: getSittingCount(),
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};
