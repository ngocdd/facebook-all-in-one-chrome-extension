import * as utils from "../utils/index.js";

const GLOBAL = {
  utils,
  fetch: (url, options) => fetch(url, options || {}).then((res) => res.text()),
  customFetch,
  getSupportedAutoRunFeatures() {
    return [
      "fb_blockSeenStory",
      "fb_showTotalPostReactions",
      "fb_addDownloadVideoBtn",
      "fb_addVideoControlBtn",
      "insta_blockSeenStory",
    ];
  },
};

function main() {
  chrome.runtime.onInstalled.addListener(async function (data) {
    // reasons: browser_update / chrome_update / update / install
    if (data?.reason === "install") {
      chrome.tabs.create({
        url: "https://facebook-all-in-one.com",
      });

      if (await utils.hasUserId()) {
        await utils.trackEvent("fb-aio-RE-INSTALLED");
      }
      // create new unique id and save it
      await utils.setUserId();
      utils.trackEvent("fb-aio-INSTALLED");
    }
  });

  chrome.runtime.onMessageExternal.addListener(
    (request, sender, sendResponse) => {
      if (request.action === "fb_allInOne_runFunc") {
        utils
          .runFunc(request.fnPath, request.params, GLOBAL)
          .then(sendResponse)
          .catch(sendResponse);
        return true;
      }
    }
  );

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      if (request.action === "aio-runInBackground") {
        const { params = [], fnPath = "" } = request.data || {};
        utils.runFunc(fnPath, params, GLOBAL).then((res) => {
          sendResponse(res);
        });
        return true;
      }
    } catch (e) {
      console.log("ERROR:", e);
      sendResponse({ error: e.message });
    }
  });
}

async function customFetch(url, options) {
  try {
    if (
      typeof options?.body === "string" &&
      options.body.startsWith("fbaio-formData:")
    ) {
      let body = options.body.replace("fbaio-formData:", "");
      body = JSON.parse(body);
      options.body = new FormData();
      for (const [key, value] of Object.entries(body)) {
        options.body.append(key, value);
      }
    }

    const res = await fetch(url, options);
    let body;

    // https://github.com/w3c/webextensions/issues/293
    try {
      if (res.headers.get("Content-Type").startsWith("text/")) {
        body = await res.clone().text();
      } else if (
        res.headers.get("Content-Type").startsWith("application/json")
      ) {
        body = await res.clone().json();
      } else {
        // For other content types, read the body as blob
        const blob = await res.clone().blob();
        body = await convertBlobToBase64(blob);
      }
    } catch (e) {
      body = await res.clone().text();
    }

    const data = {
      headers: Object.fromEntries(res.headers),
      ok: res.ok,
      redirected: res.redirected,
      status: res.status,
      statusText: res.statusText,
      type: res.type,
      url: res.url,
      body: body,
    };
    // console.log("Response from background script:", data);
    return data;
  } catch (e) {
    console.log("Fetch failed:", e);
    return null;
  }
}

main();
