
class BackgroundFetchBuilder {

  constructor() {
    /** @const @private {string} */
    this.id_ = this.getFetchId_();

    /** @private {number} */
    this.estimatedDownloadTotal_ = 0;

    /** @const @private {!Array<!Request|string>} */
    this.requests_ = this.getRequests_();

    /** @const {!BackgroundFetchOptions} */
    this.options_ = this.getOptions_();

    // Informs the SW if UI updates are expected.
    this.updateOptions_(); 
  }

  /**
   * @private
   * @return {string} The ID of the fetch request.
   */
  getFetchId_() {
    return document.getElementById('fetch-id-text').value;
  }

  /** 
   * @private 
   * @return {!Array<string|!Request>} 
   */
  getRequests_() {
    const requests = [];

    // Text file.
    if (document.getElementById('request-text').checked) {
      requests.push('resources/file.txt');
      this.estimatedDownloadTotal_ += 36;
    }

    // Image.
    if (document.getElementById('request-image').checked) {
      requests.push('resources/image.jpg');
      this.estimatedDownloadTotal_ += 17644;
    }

    // Many small files.
    if (document.getElementById('request-many-small').checked) {
      for (let i = 0; i < 100; i++)
        requests.push(`resources/file.txt?q=${i}`);
      this.estimatedDownloadTotal_ += 3600;  // 36 * 100
    }

    // Random response.
    if (document.getElementById('request-random').checked) {
      requests.push('resources/random-cat-joke.php');
      this.estimatedDownloadTotal_ += 127;  // through padding;
    }

    // Cross Origin.
    if (document.getElementById('request-cross-origin').checked) {
      requests.push('https://static.peter.sh/images/play-blue.png');
    }

    // Delay.
    if (document.getElementById('request-delay').checked) {
      const delay = document.getElementById('delay-seconds').value;
      requests.push(`resources/slow-cat-icon-response.php?delay=${delay}`);
      this.estimatedDownloadTotal_ += 17905;  // through padding;
    }

    // Missing.
    if (document.getElementById('request-404').checked) {
      requests.push('resources/missing.txt');
    }

    // Missing.
    if (document.getElementById('request-duplicate').checked) {
      requests.push('resources/random-cat-joke.php');
      requests.push('resources/random-cat-joke.php');
      this.estimatedDownloadTotal_ += 127 * 2;  // through padding;
    }

    // Upload.
    if (document.getElementById('request-upload').checked) {
      requests.push(
          new Request('resources/upload.php', 
                      {method: 'POST', body: 'body text!'}));
    }

    // Custom.
    if (document.getElementById('request-custom').checked) {
      requests.push(document.getElementById('request-custom-text').value);
    }

    return requests;
  }

  /** 
   * @private 
   * @returns {!BackgroundFetchOptions} 
   */
  getOptions_() {
    const options = {};

    // downloadTotal.
    if (document.getElementById('downloadtotal').checked) {
      const providedValue = document.getElementById('downloadtotal-text').value;
      if (providedValue && Number(providedValue)) {
        options.downloadTotal = Number(document.getElementById('downloadtotal-text').value);
      }
    } else {
      options.downloadTotal = this.estimatedDownloadTotal_;
    }

    // Title.
    if (document.getElementById('title').checked) {
      options.title = document.getElementById('title-text').value;
    }

    // ImageResource.
    if (document.getElementById('image-resource').checked) {
      const imageResource = {};

      // src.
      if (document.getElementById('image-resource-src').getAttribute('aria-pressed') === 'true')
        imageResource.src = document.getElementById('image-resource-src-text').value;

      // sizes.
      if (document.getElementById('image-resource-sizes').getAttribute('aria-pressed') === 'true')
        imageResource.sizes = document.getElementById('image-resource-sizes-text').value;
      
      // type.
      if (document.getElementById('image-resource-type').getAttribute('aria-pressed') === 'true')
        imageResource.type = document.getElementById('image-resource-type-text').value;
      
      // purpose.
      if (document.getElementById('image-resource-purpose').getAttribute('aria-pressed') === 'true')
        imageResource.purpose = document.getElementById('image-resource-purpose-text').value;

      options.icons = [imageResource];
    }

    return options;
  }

  /** 
   * Sends the SW everything it needs to know about how to handle the update event.
   * @private
   */
  updateOptions_() {
    if (!document.getElementById('update-ui').checked) 
      return;
    
    const options = {};

    // title.
    if (document.getElementById('update-ui-title').getAttribute('aria-pressed') === 'true')
      options.title = document.getElementById('update-ui-title-text').value;

    // icon.
    if (document.getElementById('image-resource-src').getAttribute('aria-pressed') === 'true') {
      const imageResource = {
        src: document.getElementById('update-ui-src-text').value,
        sizes: '128x128',
        purpose: 'any',
      };

      options.icons = [imageResource];
    }

    const numCalls = document.getElementById('update-ui-twice').checked ? 2 : 1;

    sendUpdateMessageToServiceWorker({
      id: this.id_,
      options,
      numCalls,
    });
  }

  /** 
   * @return {?BackgroundFetchRegistration}
   */
  async startFetch() {
    if (document.getElementById('fetch-twice').checked) {
      // Start another fetch first to trigger permissions.
      bgfManager.fetch(this.id_ + '-permission', ['resources/file.txt']);
    }

    try {
      const registration = await bgfManager.fetch(this.id_, this.requests_, this.options_);
      // Update default fetch-id to avoid collisions.
      document.getElementById('fetch-id-text').setAttribute('value', this.id_ + '1');
      return registration;
    } catch (e) {
      appendToLog('Error creating registration for ', this.id_, '. ', e.message);
      return null;
    }
  }
}