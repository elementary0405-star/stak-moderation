export async function GET(request: Request) {
  const url = new URL(request.url);
  url.pathname = "/api/auth/discord";
  url.search = "";
  return Response.redirect(url, 307);
}
