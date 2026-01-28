# tldr - Browser Extension

A minimal browser extension that summarizes web page text into a single sentence using OpenAI's API. Works on **Chrome**, **Edge**, **Brave**, **Opera**, and **Firefox**.

## Features

- Summarize entire page or selected text
- Clean, minimal overlay display
- Persistent or session-only API key storage
- Customizable prompt
- Model selection (gpt-3.5-turbo, gpt-4, etc.)
- Right-click context menu support

## Installation

### Chrome, Edge, Brave, Opera (one build)

Use the same unpacked folder; only the store you publish to differs.

1. Open the browser’s extensions page:
   - **Chrome:** `chrome://extensions/`
   - **Edge:** `edge://extensions/`
   - **Brave:** `brave://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this project folder (the one containing `manifest.json`)
5. The extension icon will appear in your toolbar

### Firefox

Firefox uses Manifest V2 and a separate manifest. Build a Firefox package, then load it as a temporary add-on:

1. Run the build script:
   ```bash
   ./prepare-firefox.sh
   ```
2. Open Firefox and go to `about:debugging`
3. Click "This Firefox" → "Load Temporary Add-on"
4. Choose `tldr-firefox.xpi` (created in the project root)

For signed distribution, submit `tldr-firefox.xpi` (or the unpacked folder built from `manifest.firefox.json`) to addons.mozilla.org.

## Setup

1. Click the tldr extension icon in your browser toolbar
2. Enter your OpenAI API key
3. Choose whether to save it persistently (default) or session-only
4. Optionally customize the prompt and select a different model
5. Click "Save Settings"

## Usage

### Method 1: Extension Icon
- Click the tldr icon in the toolbar to summarize the entire page
- Or select text first, then click the icon to summarize only the selection

### Method 2: Right-Click Menu
- Right-click anywhere on the page
- Select "Summarize with tldr"
- If text is selected, it will summarize the selection; otherwise, it summarizes the entire page

## Icons

You'll need to add icon files (16x16, 48x48, 128x128 PNG) to the `icons/` directory:
- `icons/icon16.png`
- `icons/icon48.png`
- `icons/icon128.png`

For now, you can use placeholder icons or create simple text-based icons.

## Permissions

- `activeTab`: Required to read text from the current tab
- `storage`: Required to store API key and settings
- `contextMenus`: Required for right-click menu functionality
