import { getTutorialCover } from "@/lib/tutorials";

type CoverRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: CoverRouteProps) {
  const { id } = await params;
  const cover = await getTutorialCover(id);
  if (!cover) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(cover), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
