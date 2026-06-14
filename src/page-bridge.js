(() => {
  if (window.__mitStudyPageBridgeInstalled) {
    return;
  }

  window.__mitStudyPageBridgeInstalled = true;

  window.addEventListener("message", async (event) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data;
    if (!data || data.source !== "mit-study-content" || data.type !== "MIT_STUDY_FETCH_RESOURCE") {
      return;
    }

    const requestId = data.requestId;
    const requestUrl = data.requestUrl;
    const requestInit = data.requestInit && typeof data.requestInit === "object" ? data.requestInit : {};

    try {
      const response = await fetch(requestUrl, {
        credentials: "include",
        ...requestInit
      });
      const text = await response.text();

      window.postMessage(
        {
          source: "mit-study-page",
          type: "MIT_STUDY_FETCH_CAPTION_RESULT",
          requestId,
          ok: response.ok,
          status: response.status,
          contentType: response.headers.get("content-type") || "",
          body: text
        },
        "*"
      );
    } catch (error) {
      window.postMessage(
        {
          source: "mit-study-page",
          type: "MIT_STUDY_FETCH_CAPTION_RESULT",
          requestId,
          ok: false,
          status: 0,
          contentType: "",
          body: "",
          error: error instanceof Error ? error.message : String(error)
        },
        "*"
      );
    }
  });
})();
