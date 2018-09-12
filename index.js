$(document).ready(async () => {

// Set-up the text field / check box stuff.
for (const textClass of $('.has-text')) {
  textClass.onchange = e => {
    if (e.target.checked)
      $(`#${e.target.id}-text`).prop('disabled', false);
    else
      $(`#${e.target.id}-text`).prop('disabled', true);
  };
}

// Set-up the radio-buttons.
for (const radioButton of $('.radio-button')) {
  radioButton.onclick = e => {
    const rb = $(`#${e.target.id}`);
    if (radioButton.getAttribute('aria-pressed') === 'true') {
      $(`#${e.target.id}-text`).prop('disabled', true);
      rb.removeClass('btn-outline-primary');
      rb.addClass('btn-outline-secondary');
    } else {
      $(`#${e.target.id}-text`).prop('disabled', false);
      rb.removeClass('btn-outline-secondary');
      rb.addClass('btn-outline-primary');
    }
  };
}

$('#start-fetch-btn').click(async e => handleClickEvent(e));

// Register service worker.
try {
  await pageSetup();
} catch (e) {
  appendToLog('Failed to set up page! ', e.message);
}

});

function appendToLog() {
  let msg = '';
  for (const arg of arguments)
    msg += typeof(arg) === 'string' ? arg : JSON.stringify(arg);
  $('#log').append(`<label><strong>[${Date.now()}]: </strong>${msg}</label><br>`);
}

async function handleClickEvent() {
  if (document.getElementById('abandon').checked) {
    await abandonFetches();
  }

  if (document.getElementById('clear-page').checked) {
    $('#log').empty();
    $('#progress-container').empty();
    $('#fetch-results-container').empty();
  }

  startFetch();
}

function createProgressBar(fetchId) {
  $('#progress-container').prepend('<br>');

  const progressBar = `
    <div class="fetch-status">
      <button type="button" class="close" aria-label="Close" id="progress-bar-close-${fetchId}" onClick="onFetchClose(id)">
        <span aria-hidden="true">×</span>
      </button>
      <h6>${fetchId} <span class="badge badge-warning badge-pill" id="progress-bar-badge-${fetchId}">pending</span></h6>
      <div class="progress center-block">
        <div class="progress-bar progress-bar-striped" role="progressbar" id="progress-bar-${fetchId}"
             style="width: 0%" aria-valuenow="0%" aria-valuemin="0" aria-valuemax="100">
        </div>
      </div>
    </div>`;
  $('#progress-container').prepend(progressBar);
}

async function onFetchClose(buttonId) {
  const fetchId = buttonId.substring('progress-bar-close-'.length);
  const registration = await bgfManager.get(fetchId);
  registration.abort();
}

function updateProgressBar(fetchId, downloaded, downloadTotal) {
  let percentage = 0; 
  if (downloadTotal) {
    percentage = Number.parseInt(downloaded * 100 / downloadTotal);
    if (percentage === 0) percentage = 1;
  } else {
    // No download total, show full progress bar.
    $(`#progress-bar-${fetchId}`).addClass('bg-warning');
    percentage = 100;
  }
  
  const progressBar = document.getElementById(`progress-bar-${fetchId}`);
  progressBar.style.width = `${percentage}%`;
  progressBar.textContent = `${downloaded}KB/${downloadTotal}KB`;
}

function finalizeProgressBar(fetchId, eventType, downloaded, downloadTotal, failureReason) {
  const progressBar = document.getElementById(`progress-bar-${fetchId}`);
  progressBar.style.width = '100%';
  progressBar.textContent = `${downloaded}KB/${downloadTotal}KB`;

  let progressBarClass = '';
  let badgeClass = '';
  let badgeText = '';
  if (eventType === 'backgroundfetchsuccess') {
    progressBarClass = 'bg-success';
    badgeClass = 'badge-success';
    badgeText = 'success';
  } else if (eventType === 'backgroundfetchfail') {
    progressBarClass = 'bg-danger';
    badgeClass = 'badge-danger';
    badgeText = 'fail';
    if (failureReason) badgeText += ' - ' + failureReason;
  } else if (eventType === 'backgroundfetchabort') {
    progressBarClass = 'bg-info';
    badgeClass = 'badge-secondary';
    badgeText = 'abandon';
  }

  $(`#progress-bar-${fetchId}`).addClass(progressBarClass);
  $(`#progress-bar-badge-${fetchId}`).removeClass('badge-warning');
  $(`#progress-bar-badge-${fetchId}`).addClass(badgeClass);
  $(`#progress-bar-badge-${fetchId}`).text(badgeText);
}

function showResponses(fetchId, results) {
  $('#fetch-results-container').prepend(`<br></br>
                                         <h2 id="result-name-${fetchId}"></h2>
                                         <ol id="result-list-${fetchId}"></ol>`);

  const resultName = document.getElementById(`result-name-${fetchId}`);
  const resultList = document.getElementById(`result-list-${fetchId}`);

  resultList.innerHTML = '';  // clear previous results
  resultName.innerText = fetchId;

  for (const result of results) {
    const listItem = document.createElement('li'),
          resourceName = document.createElement('h4'),
          resourceStatus = document.createElement('h5'),
          resourceHeaders = document.createElement('pre');
    resourceName.textContent = result.url;
    resourceStatus.textContent =
        'Status: ' + result.status + ' ('  + result.statusText + '), ' +
        'ok: ' + (result.ok ? 'true' : 'false') + ', ' +
        'redirected: ' + (result.redirected ? 'true' : 'false') + ', ' +
        'type: ' + result.type;
    for (const key in result.headers)
      resourceHeaders.textContent += key + ': ' + result.headers[key] + '\n';
    listItem.appendChild(resourceName);
    listItem.appendChild(resourceStatus);
    listItem.appendChild(resourceHeaders);
    let resourceView = null;
    const isImage = result.url.endsWith('jpg') || result.url.endsWith('png') ||
                    (result.headers.hasOwnProperty('content-type') &&
                      result.headers['content-type'].startsWith('image'));
    if (!result.data) {
      resourceView = document.createElement('span');
      resourceView.textContent = 'No response data could be read.';
    } else if (isImage) {
      resourceView = document.createElement('img');
      resourceView.src = 'data:image/jpg;base64,' + result.data;
    } else {
      resourceView = document.createElement('textarea');
      resourceView.value = atob(result.data);
    }
    listItem.appendChild(resourceView);
    resultList.appendChild(listItem);
  }
}

async function sendUpdateMessageToServiceWorker(msg) {
  const sw = await navigator.serviceWorker.ready;
  sw.active.postMessage(msg);
}