(async () => {
  console.log("FB show total post reactions ENABLED");

  const { notify } = await import("./helper/helper.js");
  const { hookXHR } = await import("./helper/ajax-hook.js");
  const { fetchGraphQl, getFbdtsg } = await import("./helper/fb-helper.js");

  const CACHED = {};
  const ReactionId = {
    "👍": "1635855486666999",
    "💖": "1678524932434102",
    "🥰": "613557422527858",
    "😆": "115940658764963",
    "😲": "478547315650144",
    "😔": "908563459236466",
    "😡": "444813342392137",
  };

  const getPostReactionsCount = async (id, reactionId) => {
    const res = await fetchGraphQl(
      {
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: "CometUFIReactionIconTooltipContentQuery",
        variables: {
          feedbackTargetID: id,
          reactionID: reactionId,
        },
        doc_id: "6235145276554312",
      },
      await getFbdtsg()
    );
    const json = JSON.parse(res || "{}");
    return json?.data?.feedback?.reactors?.count || 0;
  };

  const getTotalPostReactionCount = async (id) => {
    if (CACHED[id] === "loading") return;

    const { setText, closeAfter } = notify({
      msg: "Counting post's reactions...",
      duration: 10000,
    });
    const numberFormater = UfsGlobal.Utils.getNumberFormatter("standard");

    let res;
    if (CACHED[id]) {
      res = CACHED[id];
    } else {
      CACHED[id] = "loading";
      res = {
        total: 0,
        each: {},
      };
      for (let [name, reactionId] of Object.entries(ReactionId)) {
        const count = await getPostReactionsCount(id, reactionId);
        res.total += count;
        res.each[name] = count;
        setText(
          `Counting post's reactions ${name}... Total: ${numberFormater.format(
            res.total
          )}`
        );
      }
      CACHED[id] = res;
    }

    setText(
      "<p style='color:white;font-size:20px;padding:0;margin:0'>Total " +
        numberFormater.format(res.total) +
        " reactions.<br/>Includes " +
        Object.entries(res.each)
          .filter(([key, value]) => value > 0)
          .map(([key, value]) => `${numberFormater.format(value)}${key}`)
          .join(", ") +
        "</p>"
    );
    closeAfter(10000);
  };

  hookXHR({
    onAfterSend: (
      { method, url, async, user, password },
      dataSend,
      response
    ) => {
      let str = dataSend?.toString?.() || "";
      if (
        str.includes("CometUFIReactionsCountTooltipContentQuery") ||
        str.includes("CometUFIReactionIconTooltipContentQuery")
      ) {
        try {
          const json = JSON.parse(response);
          if (
            json?.data?.feedback?.reaction_display_config
              ?.reaction_display_strategy == "HIDE_COUNTS"
          ) {
            const id = json.data.feedback.id;
            getTotalPostReactionCount(id);
          }
        } catch (err) {
          console.log(err);
        }
      }
    },
  });
})();
