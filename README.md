# Terse - Chrome Extension

A minimal Chrome extension that summarizes web page text into a single sentence using OpenAI's API.

## Features

- Summarize entire page or selected text
- Clean, minimal overlay display
- Persistent or session-only API key storage
- Customizable prompt
- Model selection (gpt-3.5-turbo, gpt-4, etc.)
- Right-click context menu support

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `terse` folder
5. The extension icon will appear in your browser toolbar

## Setup

1. Click the Terse extension icon in your browser toolbar
2. Enter your OpenAI API key
3. Choose whether to save it persistently (default) or session-only
4. Optionally customize the prompt and select a different model
5. Click "Save Settings"

## Usage

### Method 1: Extension Icon
- Click the Terse icon in the toolbar to summarize the entire page
- Or select text first, then click the icon to summarize only the selection

### Method 2: Right-Click Menu
- Right-click anywhere on the page
- Select "Summarize with Terse"
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
