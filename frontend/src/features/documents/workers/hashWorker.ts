/// <reference lib="webworker" />

self.addEventListener('message', async (event: MessageEvent<File>) => {
  try {
    const file = event.data;
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    self.postMessage({ hash: hashHex, fileName: file.name, success: true });
  } catch (error) {
    self.postMessage({ error: (error as Error).message, success: false });
  }
});
