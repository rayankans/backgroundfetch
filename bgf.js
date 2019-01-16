let bgfManager = null;

async function handleServiceWorkerMessage(data) {
  if (data.logger) {
    appendToLog(data.logger);
  } else if (data.eventType) {
    finalizeProgressBar(data.id, data.eventType, data.downloaded, data.downloadTotal,
                        data.uploaded, data.uploadTotal, data.failureReason);
    showResponses(data.id, data.responses);
  } else {
    appendToLog('Received message from SW: ', data);
  }
}

async function registerServiceWorker() {
  const registration = await navigator.serviceWorker.register('sw.js', { scope: location.pathname });
  await navigator.serviceWorker.ready;
  appendToLog('Service Worker Registered.');

  navigator.serviceWorker.addEventListener('message', event => {
    handleServiceWorkerMessage(event.data);
  });

  return registration;
}

async function abandonFetches() {
  const pastRegistrationIds = await bgfManager.getIds();
  for (const id of pastRegistrationIds) {
    appendToLog('Abandoning: ' + id);
    const registration = await bgfManager.get(id);
    await registration.abort();
  }
}

async function pageSetup() {
  const swRegistration = await registerServiceWorker();
  bgfManager = swRegistration.backgroundFetch;
  if (bgfManager) {
    $('#start-fetch-btn').prop('disabled', false);
  } else {
    throw new Error('backgroundFetch is not available');
  }

  // Get all previous fetches.
  const registrationIds = await bgfManager.getIds();
  for (const id of registrationIds) {
    const registration = await bgfManager.get(id);
    createProgressBar(id);
    updateProgressBar(id, registration.downloaded, registration.downloadTotal,
                      registration.uploaded, registration.uploadTotal);
  }
}

function handleUpdateEvent(event) {
  appendToLog('Progress event from ', event.target.id, '. downloaded: ',
              event.target.downloaded, 'B. uploaded: ', event.target.uploaded, 'B.');
  updateProgressBar(event.target.id, event.target.downloaded, event.target.downloadTotal,
                    event.target.uploaded, event.target.uploadTotal);
}

async function startFetch() {
  const registration = await new BackgroundFetchBuilder().startFetch();
  if (!registration) return;

  appendToLog('Registered ', registration.id);
  createProgressBar(registration.id);

  registration.addEventListener('progress', e => handleUpdateEvent(e));
}