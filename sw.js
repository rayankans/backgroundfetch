// Map from fetch id to update options.
const updateMap = {};

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

self.addEventListener('message', function(event) {
  updateMap[event.data.id] = event.data;
});

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
  let response = record.responseReady
  try {
    response = await response;
  } catch (e) {
    log('No response for ' + record.request.url + ': ' + e.message);
    return Promise.resolve(null);
  }

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

  const updateOptions = updateMap[event.registration.id];
  numCalls = updateOptions ? updateOptions.numCalls : 0;
  for (let i = 0; i < numCalls; i++) {
    try {
      await event.updateUI(updateOptions.options);
      log('Update UI for ' + event.registration.id);
    } catch (e) {
      log('Failed to update UI for ' + event.registration.id + '. ' + e.message);
    }
  }

  const responses = await Promise.all(responsePromises);
  postMessageToWindow({
    eventType: event.type,
    responses: responses,
    id: event.registration.id,
    downloaded: event.registration.downloaded,
    downloadTotal: event.registration.downloadTotal,
    uploaded: event.registration.uploaded,
    uploadTotal: event.registration.uploadTotal,
    failureReason: event.registration.failureReason,
  });
}

self.addEventListener('backgroundfetchclick', (event) => {
  log('Click event for ' + event.registration.id);
  event.waitUntil(clients.openWindow('/'));
});

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
  delete updateMap[event.registration.id];
  event.waitUntil(handleBackgroundFetchEvent(event));
});
