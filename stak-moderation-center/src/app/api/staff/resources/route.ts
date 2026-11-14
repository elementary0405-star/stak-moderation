import { authorizePortalRequest } from "@/lib/portal-api-auth";
import { STAFF_RESOURCE_DOCUMENTS } from "@/lib/staff-resource-documents";

export async function GET(request: Request): Promise<Response> {
  const authorization = await authorizePortalRequest(request, "staff");
  if ("response" in authorization && authorization.response) return authorization.response;

  const slug = new URL(request.url).searchParams.get("document") ?? "";
  const document = STAFF_RESOURCE_DOCUMENTS[slug];
  if (!document) {
    return Response.json(
      { error: "Resource not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { document },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

