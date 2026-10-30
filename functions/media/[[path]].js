export async function onRequest(context) {
  const url = new URL(context.request.url);
  const response = await context.next();
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  
  // If the file is not found on Cloudflare Pages static storage (returns 404 or index.html fallback)
  if (!response.ok || contentType.includes('text/html')) {
    const upstreamUrl = 'https://wookyunghub.pythonanywhere.com' + url.pathname + url.search;
    try {
      const headers = new Headers(context.request.headers);
      headers.set('Host', 'wookyunghub.pythonanywhere.com');
      const upstreamResp = await fetch(upstreamUrl, {
        method: context.request.method,
        headers: headers,
      });
      if (upstreamResp.ok) {
        return upstreamResp;
      }
    } catch (e) {}
  }
  return response;
}
