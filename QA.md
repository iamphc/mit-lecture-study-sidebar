# Manual QA Checklist

Use this checklist for the final real-environment acceptance pass in Chrome.

## 1. Load the extension

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select either:
   - the repository root
   - or the packaged folder `dist/mit-lecture-study-sidebar`

Expected result:

- The extension loads without manifest errors
- Clicking the extension icon opens the popup

## 2. Verify popup and settings

1. Open the popup
2. Click `DeepSeek Settings`
3. Fill in:
   - DeepSeek API key
   - Base URL
   - Model
4. Click `Test DeepSeek`

Expected result:

- The settings page shows `Connected: <model>` on success
- On failure, the settings page shows an explicit error string

## 3. Verify sidebar injection on a real MIT lecture

1. Open a YouTube MIT OpenCourseWare lecture page with captions
2. Confirm the right-side sidebar appears
3. If needed, reopen it using the close/open toggle

Expected result:

- Sidebar appears only on watch pages
- Sidebar shows video title and controls

## 4. Verify automatic content loading

1. Open a MIT lecture video and wait for the sidebar to start automatically
2. Watch the progress text while the extension reads lecture content

Expected result:

- The sidebar does not require a manual caption button
- The progress text moves through content-reading and DeepSeek generation stages
- The normal UI does not expose transcript/debug tabs

## 5. Verify DeepSeek generation

1. Use a valid DeepSeek API key in the settings page
2. Open a lecture and wait for automatic outline generation
3. For a long lecture, confirm partial outline sections appear before the full run completes
4. Check the `Outline` tab

Expected result:

- Chinese outline content appears progressively
- The final status reaches completion and the generated outline is saved locally
- No local generation mode is shown

## 6. Verify DeepSeek error behavior

1. Break the DeepSeek config on purpose:
   - use an invalid API key
   - or an invalid base URL
2. Click `Regenerate`

Expected result:

- The extension reports the DeepSeek error
- No local fallback result is generated
- Already completed partial chunks are not saved as a final lecture record unless the run completes

## 7. Verify fullscreen sidebar

1. Start playback
2. Enter fullscreen
3. Confirm the sidebar is still visible and usable

Expected result:

- Sidebar remains visible in fullscreen
- `Jump` buttons still work
- Transcript highlighting still updates during playback

## 8. Verify caching and history

1. Generate a study pack
2. Reload the page or reopen the same lecture
3. Open the `Library` tab

Expected result:

- The final outline restores from cache
- The lecture appears in the library

## 9. Collect diagnostics when something fails

1. Open the browser console for the YouTube tab
2. Save relevant `[MIT Study]` logs alongside:
   - the lecture URL
   - whether captions existed on YouTube
   - whether DeepSeek settings test succeeded

This is the fastest way to debug real-environment failures.
