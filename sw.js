self.addEventListener('install', function(event) {
  event.waitUntil(skipWaiting());
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

async function postMessageToWindow(msg) {
  const matchedClients = await clients.matchAll({type: 'window'});
  for (const client of matchedClients) {
    client.postMessage(msg);
  }
}

function log(msg) {
  postMessageToWindow({logger: msg});
}

async function cloneResponse(response) { 
  if (!response.body) return;

  // Clone |response| and stream because of some legacy Paul joke.
  const clone = response.clone();
  const reader = clone.body.getReader();
  let byteCount = 0;

  const onStreamData = streamResult => {
    if (streamResult.done) {
      log('Read ' + byteCount + ' bytes from the cloned response for ' + response.url);
      return;
    }

    byteCount += streamResult.value.length;
    return reader.read().then(onStreamData);
  };

  reader.read().then(onStreamData);
}

async function extractResponse(record) {
  const response = await record.responseReady;
  
  // Extract headers.
  const headers = {};
  for (const [name, value] of response.headers) {
    headers[name] = value;
  }

  // Extract result.
  const result = {
    type: response.type,
    url: response.url,
    redirected: response.redirected,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    headers: headers,
    data: null,
  }

  // cloneResponse(response);

  const buffer = await response.arrayBuffer();
  log('Read ' + buffer.byteLength + ' bytes for ' + response.url);

  const uint8Buffer = new Uint8Array(buffer);
  let uint8Data = '';
  for (let i = 0; i < buffer.byteLength; ++i) {
    uint8Data += String.fromCharCode(uint8Buffer[i]);
  }
  result.data = btoa(uint8Data);
  return result;
}

async function handleBackgroundFetchEvent(event) {
  const responsePromises = [];
  const records = await event.registration.matchAll();
  for (const record of records) {
    responsePromises.push(extractResponse(record));
  }
  const responses = await Promise.all(responsePromises);
  postMessageToWindow({
    eventType: event.type,
    responses: responses,
    id: event.registration.id,
    downloaded: event.registration.downloaded,
    downloadTotal: event.registration.downloadTotal,
    failureReason: event.registration.failureReason,
  });
}

self.addEventListener('backgroundfetchsuccess', async (event) => {
  log('Received backgroundfetchsuccess for ' + event.registration.id);
  event.waitUntil(handleBackgroundFetchEvent(event));
});

self.addEventListener('backgroundfetchfail', async (event) => {
  log('Received backgroundfetchfail for ' + event.registration.id);
  event.waitUntil(handleBackgroundFetchEvent(event));
});

self.addEventListener('backgroundfetchabort', async (event) => {
  log('Received backgroundfetchabort for ' + event.registration.id);
  postMessageToWindow({
    eventType: event.type,
    responses: [],
    id: event.registration.id,
    downloaded: event.registration.downloaded,
    downloadTotal: event.registration.downloadTotal,
    failureReason: event.registration.failureReason,
  });
});