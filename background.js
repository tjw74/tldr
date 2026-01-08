const DEFAULT_PROMPT = "Summarize this text into a single sentence that describes the primary point of the text";

// Set up context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'terse-summarize',
    title: 'Summarize with Terse',
    contexts: ['page', 'selection']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'terse-summarize') {
    const useSelection = info.selectionText && info.selectionText.trim().length > 0;
    chrome.tabs.sendMessage(tab.id, {
      action: 'summarize',
      useSelection: useSelection
    });
  }
});

// Handle messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'summarize') {
    handleSummarize(request.text).then(sendResponse);
    return true; // Keep channel open for async response
  }
});

// Handle summarize API call
async function handleSummarize(text) {
  try {
    console.log('Terse background: Starting API call, text length:', text ? text.length : 0);
    
    // Get API key (check both storages)
    const localData = await chrome.storage.local.get(['apiKey', 'model', 'prompt']);
    const sessionData = await chrome.storage.session.get(['apiKey']);
    
    const apiKey = localData.apiKey || sessionData.apiKey;
    
    console.log('Terse background: API key found:', apiKey ? 'Yes' : 'No');
    
    if (!apiKey) {
      return {
        success: false,
        error: 'API key not found. Please configure it in the extension settings.'
      };
    }

    // Get model and prompt
    const model = localData.model || 'gpt-3.5-turbo';
    const prompt = localData.prompt || DEFAULT_PROMPT;
    
    console.log('Terse background: Using model:', model);

    // Call OpenAI API
    console.log('Terse background: Calling OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: prompt
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    });

    console.log('Terse background: API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Terse background: API error:', errorData);
      let errorMessage = 'Failed to summarize text';
      
      if (response.status === 401) {
        errorMessage = 'Invalid API key. Please check your API key in settings.';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.';
      } else if (errorData.error && errorData.error.message) {
        errorMessage = errorData.error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }

    const data = await response.json();
    console.log('Terse background: API response data:', data);
    const summary = data.choices[0]?.message?.content?.trim();

    if (!summary) {
      return {
        success: false,
        error: 'No summary returned from API'
      };
    }

    console.log('Terse background: Summary generated successfully');
    return {
      success: true,
      summary: summary
    };
  } catch (error) {
    console.error('Terse background: Exception:', error);
    return {
      success: false,
      error: 'Network error: ' + error.message
    };
  }
}
