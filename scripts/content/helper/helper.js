export function sendToContentScript(event, data) {
  return new Promise((resolve, reject) => {
    let uuid = Math.random().toString(36); // uuid to distinguish events
    let listenerKey = "aio-contentscript-sendto-pagescript" + uuid;
    window.addEventListener(listenerKey, (evt) => resolve(evt.detail.data), {
      once: true,
    });
    window.dispatchEvent(
      new CustomEvent("aio-pagescript-sendto-contentscript", {
        detail: { event, data, uuid },
      })
    );
  });
}

export function runInContentScript(fnPath, params) {
  // WARNING: can only transfer serializable data
  return sendToContentScript("aio-runInContentScript", {
    fnPath,
    params,
  });
}

export function runInBackground(fnPath, params) {
  if (typeof chrome?.runtime?.sendMessage == "function") {
    return chrome.runtime.sendMessage({
      action: "aio-runInBackground",
      data: { fnPath, params },
    });
  }
  return sendToContentScript("aio-runInBackground", {
    fnPath,
    params,
  });
}

export function getURL(filePath) {
  return runInContentScript("chrome.runtime.getURL", [filePath]);
}

export async function getExtStorage(key) {
  return runInContentScript("utils.Storage.get", [key]);
}

export async function setExtStorage(key, value) {
  return runInContentScript("utils.Storage.set", [key, value]);
}

export function notify({
  msg = "",
  x = window.innerWidth / 2,
  y = window.innerHeight - 100,
  align = "center",
  styleText = "",
  duration = 3000,
} = {}) {
  let id = "aio_notify_div";
  let exist = document.getElementById(id);
  if (exist) exist.remove();

  // create notify msg in website at postion, fade out animation, auto clean up
  let div = document.createElement("div");
  div.id = id;
  div.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        padding: 10px;
        background-color: #333;
        color: #fff;
        border-radius: 5px;
        z-index: 2147483647;
        transition: all 1s ease-out;
        ${
          align === "right"
            ? "transform: translateX(-100%);"
            : align === "center"
            ? "transform: translateX(-50%);"
            : ""
        }
        ${styleText || ""}
      `;
  div.innerHTML = createTrustedHtml(msg);
  (document.body || document.documentElement).appendChild(div);

  let timeouts = [];
  function closeAfter(_time) {
    timeouts.forEach((t) => clearTimeout(t));
    timeouts = [
      setTimeout(() => {
        if (div) {
          div.style.opacity = 0;
          div.style.top = `${y - 50}px`;
        }
      }, _time - 1000),
      setTimeout(() => {
        div?.remove();
      }, _time),
    ];
  }

  closeAfter(duration);

  return {
    closeAfter: closeAfter,
    remove() {
      if (div) {
        div.remove();
        div = null;
        return true;
      }
      return false;
    },
    setText(text, duration) {
      if (div) {
        div.innerHTML = createTrustedHtml(text);
        if (duration) closeAfter(duration);
        return true;
      }
      return false;
    },
    setPosition(x, y) {
      if (div) {
        div.style.left = `${x}px`;
        div.style.top = `${y}px`;
        return true;
      }
      return false;
    },
  };
}

export function getTrustedPolicy() {
  let policy = window.trustedTypes?.aioTrustedTypesPolicy || null;
  if (!policy) {
    policy = window.trustedTypes.createPolicy("fbaioTrustedTypesPolicy", {
      createHTML: (string, sink) => string,
      createScriptURL: (string) => string,
      createScript: (string) => string,
    });
  }
  return policy;
}

export function createTrustedHtml(html) {
  let policy = getTrustedPolicy();
  return policy.createHTML(html);
}

const numberFormatCached = {};
/**
 * Get number formatter
 * @param {string} optionSelect "compactLong", "standard", "compactShort"
 * @param {string|undefined} locale Browser locale
 * @return {Intl.NumberFormat}
 */
export function getNumberFormatter(optionSelect, locale) {
  if (!locale) {
    if (document.documentElement.lang) {
      locale = document.documentElement.lang;
    } else if (navigator.language) {
      locale = navigator.language;
    } else {
      try {
        locale = new URL(
          Array.from(document.querySelectorAll("head > link[rel='search']"))
            ?.find((n) => n?.getAttribute("href")?.includes("?locale="))
            ?.getAttribute("href")
        )?.searchParams?.get("locale");
      } catch {
        console.log(
          "Cannot find browser locale. Use en as default for number formatting."
        );
        locale = "en";
      }
    }
  }
  let formatterNotation;
  let formatterCompactDisplay;
  switch (optionSelect) {
    case "compactLong":
      formatterNotation = "compact";
      formatterCompactDisplay = "long";
      break;
    case "standard":
      formatterNotation = "standard";
      formatterCompactDisplay = "short";
      break;
    case "compactShort":
    default:
      formatterNotation = "compact";
      formatterCompactDisplay = "short";
  }

  let key = locale + formatterNotation + formatterCompactDisplay;
  if (!numberFormatCached[key]) {
    const formatter = Intl.NumberFormat(locale, {
      notation: formatterNotation,
      compactDisplay: formatterCompactDisplay,
    });
    numberFormatCached[key] = formatter;
  }
  return numberFormatCached[key];
}

export function onElementsAdded(selector, callback, once) {
  let nodes = document.querySelectorAll(selector);
  if (nodes?.length) {
    callback(nodes);
    if (once) return;
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (!mutation.addedNodes) return;

      for (let node of mutation.addedNodes) {
        if (node.nodeType != 1) continue; // only process Node.ELEMENT_NODE

        let n = node.matches(selector)
          ? [node]
          : Array.from(node.querySelectorAll(selector));

        if (n?.length) {
          callback(n);
          if (once) observer.disconnect();
        }
      }
    });
  });

  observer.observe(document, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false,
  });

  // return disconnect function
  return () => observer.disconnect();
}

export function onElementRemoved(element, callback) {
  if (!element.parentElement) throw new Error("element must have parent");

  let observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === "childList") {
        if (mutation.removedNodes.length > 0) {
          for (let node of mutation.removedNodes) {
            if (node === element) {
              callback?.(node);
              observer.disconnect();
            }
          }
        }
      }
    });
  });

  observer.observe(element.parentElement, {
    childList: true,
  });

  return () => observer.disconnect();
}

export function closest(element, selector) {
  let el = element;
  while (el !== null) {
    if (el.matches(selector)) return el;

    let found = el.querySelector(selector);
    if (found) return found;

    el = el.parentElement;
  }
  return el;
}
