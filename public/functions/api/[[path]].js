export async function onRequest(context) {
  const url = new URL(context.request.url);
  const targetUrl = new URL(url.pathname + url.search, 'https://wookyunghub.pythonanywhere.com');
  
  const headers = new Headers(context.request.headers);
  headers.set('Host', 'wookyunghub.pythonanywhere.com');
  headers.set('X-Forwarded-Host', url.hostname);
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

  return fetch(targetUrl.toString(), {
    method: context.request.method,
    headers: headers,
    body: context.request.body,
    redirect: 'follow'
  });
}
