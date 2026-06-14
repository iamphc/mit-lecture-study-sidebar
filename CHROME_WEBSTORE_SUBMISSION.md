# Chrome Web Store Submission Notes

## Upload package

Upload this ZIP in Chrome Web Store Developer Dashboard:

```text
dist/mit-lecture-study-sidebar-v0.1.0.zip
```

The ZIP contains only:

- `manifest.json`
- `assets/icons/*.png`
- `src/*`

It does not include `data/`, `dist/`, `node_modules/`, `.npm-cache/`, or test files.

## Store listing

Suggested name:

```text
MIT 课程学习侧边栏
```

Suggested short description:

```text
把 YouTube 上的 MIT 课程视频自动整理成中文大纲，并支持跳转、导出和本地资料库。
```

Suggested detailed description:

```text
MIT 课程学习侧边栏是一个用于 YouTube MIT OpenCourseWare 视频的学习辅助扩展。

打开课程视频后，扩展会在右侧显示学习侧边栏，自动读取课程文字内容，并使用用户自己配置的 DeepSeek API Key 生成中文课程大纲。长视频会分段生成，已完成的段落会先显示出来，不需要等待整节课全部处理完。

主要功能：
- 自动生成中文课程大纲
- 点击时间戳跳转到对应视频位置
- 长课程分段生成并渐进展示
- 导出 Markdown 或复制大纲
- 本地保存已生成课程记录，方便后续检索
- 可选启动本地 CSV 服务，将课程记录保存到本机项目目录

隐私说明：
- 扩展不内置任何 API Key。
- DeepSeek API Key 只保存在用户浏览器的 Chrome storage 中。
- 课程大纲、缓存和资料库默认保存在用户本地浏览器。
- 可选 CSV 保存只写入用户本机 `data/` 目录。
- 扩展会向 YouTube 读取当前视频页面和字幕/文字记录数据。
- 扩展会将课程文字内容发送到用户配置的 DeepSeek API 端点，用于生成大纲。
```

## Category

Recommended category:

```text
Productivity
```

Alternative:

```text
Education
```

## Permissions justification

### `storage`

Used to store user settings, including DeepSeek configuration, sidebar preferences, cached generated outlines, and local library index.

### `scripting`

Used to inject a page bridge on YouTube pages so the extension can read page-context YouTube metadata and transcript-related data that are not directly available to isolated content scripts.

### `activeTab`

Used for extension interaction with the active YouTube tab when the user opens or operates the extension.

### `unlimitedStorage`

Used because lecture transcripts and generated outlines can be large for long courses, and the extension stores per-video study records locally.

## Host permissions justification

### `https://www.youtube.com/*`

Required to run the sidebar on YouTube watch pages, read lecture metadata and transcript/caption data, and provide timestamp jump behavior.

### `http://127.0.0.1:45873/*` and `http://localhost:45873/*`

Used only for optional local CSV saving through the included local CSV server. This lets users save generated lecture records to their own machine.

## Data usage / privacy answers

Suggested answers:

- Does the extension collect personally identifiable information? No.
- Does the extension collect authentication information? The user enters a DeepSeek API Key, which is stored locally in Chrome storage and used only to call the configured DeepSeek endpoint.
- Does the extension collect website content? It reads the current YouTube lecture page content/transcript to generate a study outline.
- Does the extension transmit data externally? Yes. Lecture transcript text is sent to the user-configured DeepSeek-compatible API endpoint for outline generation.
- Does the extension sell or transfer user data unrelated to single-purpose use? No.
- Does the extension use data for advertising or creditworthiness? No.

## Suggested screenshots

Prepare at least one screenshot showing:

- A YouTube MIT lecture page
- The right-side sidebar
- A generated Chinese outline with timestamp jump buttons
- The progress bar or generated outline state

Avoid screenshots that show your real DeepSeek API key, browser profile details, private tabs, or local CSV data.
