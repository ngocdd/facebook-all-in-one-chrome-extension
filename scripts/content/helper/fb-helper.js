export function wrapGraphQlParams(params) {
  const formBody = [];
  for (const property in params) {
    const encodedKey = encodeURIComponent(property);
    const value =
      typeof params[property] === "string"
        ? params[property]
        : JSON.stringify(params[property]);
    const encodedValue = encodeURIComponent(value);
    formBody.push(encodedKey + "=" + encodedValue);
  }
  return formBody.join("&");
}

export async function fetchGraphQl(params, fb_dtsg) {
  let form;
  if (typeof params === "string")
    form =
      "fb_dtsg=" +
      encodeURIComponent(fb_dtsg) +
      "&q=" +
      encodeURIComponent(params);
  else
    form = wrapGraphQlParams({
      fb_dtsg,
      ...params,
    });

  let res = await fetch("https://www.facebook.com/api/graphql/", {
    body: form,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    credentials: "include",
  });

  let json = await res.text();
  return json;
}
export async function getFbdtsg() {
  let methods = [
    () => require("DTSGInitData").token,
    () => require("DTSG").getToken(),
    () => {
      return RegExp(/"DTSGInitialData",\[],{"token":"(.+?)"/).exec(
        document.documentElement.innerHTML
      )?.[1];
    },
    async () => {
      let res = await fetch("https://mbasic.facebook.com/photos/upload/");
      let text = await res.text();
      return RegExp(/name="fb_dtsg" value="(.*?)"/).exec(text)?.[1];
    },
    async () => {
      let res = await fetch("https://m.facebook.com/home.php", {
        headers: {
          Accept: "text/html",
        },
      });
      let text = await res.text();
      return (
        RegExp(/"dtsg":{"token":"([^"]+)"/).exec(text)?.[1] ||
        RegExp(/"name":"fb_dtsg","value":"([^"]+)/).exec(text)?.[1]
      );
    },
    () => require("DTSG_ASYNC").getToken(), // TODO: trace xem tại sao method này trả về cấu trúc khác 2 method trên
  ];
  for (let m of methods) {
    try {
      let d = await m();
      if (d) return d;
    } catch (e) {}
  }
  return null;
}
