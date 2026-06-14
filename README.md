# MIT Lecture Study Sidebar

Chrome extension for studying MIT OpenCourseWare videos on YouTube. It automatically turns lecture content into a compact Chinese outline in a right-side study sidebar.

## Core capabilities

- Generates a structured lecture outline
- Separately analyzes visible PPT/board frames from locally extracted text
- Works in a right-side overlay that remains visible even when the video enters fullscreen
- Uses DeepSeek for outline generation
- Uses a three-step PPT pipeline: local keyframe selection, local OCR extraction, then DeepSeek text-only analysis
- Exports the generated outline as Markdown or copies it to clipboard
- Saves per-video study results locally and shows recent lecture history
- Splits long lecture content into multiple DeepSeek requests, progressively renders completed chunks, and locally deduplicates the final outline

## Files

- `manifest.json`: Chrome extension manifest
- `src/content.js`: YouTube page integration, content extraction, sidebar rendering, and export
- `src/background.js`: DeepSeek request pipeline, content chunking, JSON parsing fallback, settings bootstrap
- `src/sidebar.css`: Sidebar UI styling
- `src/options.html`: settings page
- `src/options.css`: settings page styles
- `src/options.js`: settings page logic

## How to load

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select either the repository root or the packaged folder `dist/mit-lecture-study-sidebar`

## Local verification

Run the parser fixture test:

```bash
npm run test
```

This validates the two main HTML extraction paths currently covered in code:

- inline `ytInitialPlayerResponse`
- escaped `playerResponse` payloads embedded in page data

Run the full local verification set:

```bash
npm run verify
```

This runs:

- syntax checks for the extension scripts
- parser fixture tests
- DeepSeek chunking and JSON fallback tests
- harness file checks for popup/options/sidebar local smoke pages
- jsdom UI smoke tests for popup, options, and sidebar injection

## DeepSeek setup

1. After loading the extension, open the extension details page
2. Open `Extension options`
3. Fill in:
   - `DeepSeek API key`
   - `DeepSeek base URL`
   - `Model`
   - `Output language`
   - `Sidebar width`
4. Save settings

Default values:

- Base URL: `https://api.deepseek.com`
- Model: `deepseek-v4-flash`

If your DeepSeek account uses a different compatible endpoint or model name, change it in settings.

## Local visual model

PPT frame processing runs in three stages:

1. The browser locally filters video frames to find likely PPT/key teaching frames.
2. The browser locally extracts raw OCR text from those frames without interpretation.
3. DeepSeek receives only the extracted text and nearby transcript context to produce Chinese analysis.

Users do not need to install a local service or download a model manually. The extension bundles the Transformers.js runtime and downloads the default browser OCR model automatically on first use. Model files are cached by Chrome after the first download. Sampled images are not sent to DeepSeek or Hugging Face.

## Usage flow

1. Open a YouTube MIT lecture.
2. Open the extension options page, fill the DeepSeek API Key, and click `选择目录` under `本地保存目录`.
3. If `自动分析课程视频` is enabled, the sidebar automatically generates a Chinese outline. If it is disabled, click `生成大纲` when you want to analyze the current video.
4. Keep watching the lecture. The `画面` tab progressively collects separate PPT analysis when useful frames appear.
5. Use `Jump` to go back to the relevant video timestamp.
6. Reopen the same lecture later and restore from local cache, or use the local files in the selected save directory.

## Packaging

Build a distributable folder for Chrome manual loading:

```bash
npm run pack
```

This creates:

- `dist/mit-lecture-study-sidebar`

That folder is the packaged extension directory you can load into Chrome or hand off to someone else.

Build a zipped handoff artifact:

```bash
npm run pack:zip
```

This creates:

- `dist/mit-lecture-study-sidebar.zip`

## Local data

Per-user study data is local-only. Chrome extension storage is used as a fast UI cache, and the selected local save directory is the durable data store.

The options page has one formal `本地保存目录` selector. Click `选择目录` and approve write access in the system Finder/File Explorer dialog. After a lecture outline is generated, the extension writes:

- `lecture_library.csv` in the selected root directory, upserted by `video_id`
- `lectures/<video_id>/lecture.json`
- `lectures/<video_id>/study_pack.md`

The saved record includes the video URL, video title, published/upload date when available, watched time, full transcript, generated outline, PPT visual analysis, tags/metadata fields, and Markdown. No `npm run csv-server` process is required for normal use.

`npm run csv-server` remains only as a legacy development helper for older CSV/debug flows. It is not part of the normal extension workflow.

## Local smoke harness

The repository also includes browser-loadable harness pages under:

- `test/harness/popup-harness.html`
- `test/harness/options-harness.html`
- `test/harness/sidebar-harness.html`

These use a mock `chrome.*` environment to exercise popup, options, and sidebar behavior without a real extension install. They do not replace real Chrome extension validation, but they reduce obvious first-run breakage.

## Manual QA

For the final real-environment acceptance pass, follow:

- `QA.md`

## Product behavior

- DeepSeek is used for transcript outline generation
- PPT processing is split into local keyframe selection, local OCR extraction, and DeepSeek text-only analysis
- Saved lecture results are cached per YouTube video ID
- Long lecture content is chunked before DeepSeek analysis; completed chunks appear progressively in the sidebar
- PPT analysis is stored separately from transcript-based outline content, including the raw OCR text for later search
- Final outlines are locally merged, deduplicated, and sorted by timestamp
- Malformed model JSON is retried through a repair prompt; if one chunk still cannot be repaired, that chunk is skipped instead of failing the whole lecture
- Settings changes propagate to the sidebar without manually editing code
- The sidebar is designed to move into the fullscreen container when the player enters fullscreen
- On non-watch YouTube pages, the extension now shows a lightweight prompt instead of an empty study UI
- If DeepSeek is missing an API key or fails at runtime, the sidebar shows an error and waits for the user to fix settings or retry
- The sidebar is focused on generated content and hides runtime diagnostics from the normal UI

## Current limitations

- It still depends on YouTube exposing usable lecture text data on the watch page
- Content extraction can still break if YouTube changes page metadata structure
- The current export is Markdown only
- Transcript outline generation needs a DeepSeek-compatible text model
- Visual frame analysis needs network access on first use to download the browser model files, then reuses the browser cache

## Release checklist

1. Run `npm run verify`
2. Run `npm run pack`
3. Load `dist/mit-lecture-study-sidebar` in Chrome
4. Verify popup, options page, sidebar injection, fullscreen sidebar, DeepSeek generation, and visual frame analysis on a real MIT lecture page

## Best next improvements

- Add one-click collection of unanswered teacher questions
- Add bilingual output with aligned English and Chinese notes
- Add review cards and spaced repetition exports
