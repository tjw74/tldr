# Privacy Policy — tldr (Chrome Extension)

Last updated: 2026-01-28

## Summary
**tldr** summarizes the current webpage or selected text when you request it. To generate the summary, the extension sends the text you choose to summarize to the **OpenAI API**.

## Data we collect
tldr does **not** collect analytics, track you across sites, or sell your data.

The extension may process/store the following on your device:
- **OpenAI API key** (if you choose to save it)
- **Settings** (selected model and prompt)
- **Usage/cost stats** (request counts and cost totals)

## Data we share
When you use tldr to summarize:
- The extension sends the **selected text** (or **visible page text**) to **OpenAI** to generate the summary.
- The request is sent from your browser to OpenAI over HTTPS.

OpenAI may process the data according to their policies. You can review OpenAI’s policies here: `https://openai.com/policies/`

## Permissions
tldr requests the minimum permissions needed to work:
- **activeTab / host access**: to read visible text from the page you are summarizing
- **scripting**: to inject the content script and UI overlay when you click the extension
- **contextMenus**: to provide a right‑click “Summarize with tldr” action
- **storage**: to store your API key and settings locally

## Data retention
- Your API key/settings/usage stats are stored **locally in your browser** and remain until you remove them or uninstall the extension.
- Text you summarize is not stored by the extension after the request completes.

## Security
- Your API key is stored in Chrome extension storage on your device.
- Do not use tldr on shared computers if you store your API key persistently.

## Your choices
- You can remove your API key at any time in the extension settings.
- You can uninstall the extension to remove all locally stored data.

## Contact
If you have questions, contact the publisher via the email listed on the Chrome Web Store listing.

