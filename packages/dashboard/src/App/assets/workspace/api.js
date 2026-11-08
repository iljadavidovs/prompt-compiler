let session;
export async function api(path, body, renewed = false) {
  session ||= fetch('/v1/session', { headers: { 'x-pcr-bootstrap': '1' }, cache: 'no-store' }).then(async response => {
    if (!response.ok) throw new Error('Local session unavailable. Open this page directly on its loopback URL.');
    return (await response.json()).token;
  }).catch(error => { session = undefined; throw error instanceof TypeError ? new Error('Could not reach the local runtime. Your draft is preserved. Restart the local server and retry.') : error; });
  const token = await session;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`/v1${path}`, { method: body === undefined ? 'GET' : 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', 'x-pcr-token': token }, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    if (response.status === 401 && !renewed) { session = undefined; return api(path, body, true); }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Local request failed (${response.status}).`);
    return data;
  } catch (error) {
    if (error instanceof TypeError) throw new Error('Could not reach the local runtime. Your draft is preserved. Restart the local server and retry.');
    if (error.name === 'AbortError') throw new Error('The local request timed out. Your draft is preserved. A compilation may have finished; retry uses the same request identity.');
    throw error;
  } finally { clearTimeout(timer); }
}

export function download(name, content, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name.replace(/[^a-zA-Z0-9._-]/g, '-'); link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
