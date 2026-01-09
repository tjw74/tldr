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
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'terse-summarize') {
    try {
      // Check if we can inject into this page
      if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://'))) {
        return;
      }

      const useSelection = info.selectionText && info.selectionText.trim().length > 0;

      // Inject content script and CSS if needed
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['styles.css']
        });
      } catch (cssError) {
        // Ignore CSS injection errors
      }

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        // Wait for script to initialize
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (scriptError) {
        console.error('Terse: Could not inject content script:', scriptError);
        return;
      }

      // Send message to content script
      chrome.tabs.sendMessage(tab.id, {
        action: 'summarize',
        useSelection: useSelection
      }).catch(error => {
        console.error('Terse: Error sending message:', error);
      });
    } catch (error) {
      console.error('Terse: Error in context menu handler:', error);
    }
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
    const model = localData.model || 'gpt-5-nano';
    const prompt = localData.prompt || DEFAULT_PROMPT;
    
    console.log('Terse background: Using model:', model);

    // Determine which parameters to use based on model
    // GPT-5 series, GPT-4.1 series, and o-series models use max_completion_tokens
    // Older models (GPT-4, GPT-3.5) use max_tokens
    const isNewModel = model.startsWith('gpt-5') || 
                       model.startsWith('gpt-4.1') || 
                       model.startsWith('o3') || 
                       model.startsWith('o4');
    
    // Some newer models don't support temperature or only support default value of 1
    // GPT-5 series models typically don't support custom temperature
    const supportsTemperature = !model.startsWith('gpt-5');

    // Build API request body
    const apiBody = {
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
      ]
    };
    
    // Use the correct token limit parameter based on model
    // Reasoning models (GPT-5 series) need more tokens because they use tokens for reasoning
    // We need enough tokens for both reasoning AND the actual output
    if (isNewModel) {
      // For reasoning models, allocate more tokens to ensure we get actual output
      // Reasoning models use tokens for internal reasoning, so we need extra headroom
      if (model.startsWith('gpt-5')) {
        apiBody.max_completion_tokens = 500; // More tokens for reasoning models
      } else {
        apiBody.max_completion_tokens = 150;
      }
    } else {
      apiBody.max_tokens = 150;
    }
    
    // Only add temperature if the model supports it
    if (supportsTemperature) {
      apiBody.temperature = 0.7;
    }

    // Call OpenAI API
    console.log('Terse background: Calling OpenAI API...');
    console.log('Terse background: API body:', JSON.stringify(apiBody, null, 2));
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(apiBody)
    });

    console.log('Terse background: API response status:', response.status);

    if (!response.ok) {
      let errorData = {};
      try {
        errorData = await response.json();
      } catch (parseError) {
        console.error('Terse background: Could not parse error response');
      }
      
      console.error('Terse background: API error status:', response.status);
      console.error('Terse background: API error data:', JSON.stringify(errorData, null, 2));
      
      let errorMessage = 'Failed to summarize text';
      
      if (response.status === 401) {
        errorMessage = 'Invalid API key. Please check your API key in settings.';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.';
      } else if (errorData.error) {
        // Handle different error formats
        if (typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        } else if (errorData.error.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }

    const data = await response.json();
    console.log('Terse background: API response data:', JSON.stringify(data, null, 2));
    
    // Handle different response formats - OpenAI Chat Completions API standard format
    let summary = null;
    
    // Standard OpenAI format: data.choices[0].message.content
    if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
      const choice = data.choices[0];
      
      // Check finish_reason to see if response was cut off
      if (choice.finish_reason && choice.finish_reason !== 'stop') {
        console.warn('Terse background: Response finish_reason:', choice.finish_reason);
      }
      
      // Standard format: choice.message.content
      if (choice.message && typeof choice.message === 'object') {
        const content = choice.message.content;
        // Handle empty string case (can happen with reasoning models when tokens are exhausted)
        if (content != null && typeof content === 'string') {
          const trimmed = content.trim();
          if (trimmed.length > 0) {
            summary = trimmed;
          } else if (choice.finish_reason === 'length') {
            // Response was cut off - this means all tokens were used for reasoning
            console.warn('Terse background: Content is empty and finish_reason is "length" - tokens exhausted');
            return {
              success: false,
              error: 'Response was cut off. The model used all tokens for reasoning. Try increasing max_completion_tokens or using a non-reasoning model like GPT-4.1.'
            };
          }
        }
      }
      
      // Fallback: check for direct content in choice
      if (!summary && choice.content != null && typeof choice.content === 'string' && choice.content.trim().length > 0) {
        summary = choice.content.trim();
      }
      
      // Fallback: check for text in choice
      if (!summary && choice.text != null && typeof choice.text === 'string' && choice.text.trim().length > 0) {
        summary = choice.text.trim();
      }
    }
    
    // Fallback: check for direct content in response root
    if (!summary && data.content != null && typeof data.content === 'string' && data.content.trim().length > 0) {
      summary = data.content.trim();
    }
    
    // Fallback: check for message in response root
    if (!summary && data.message) {
      if (typeof data.message === 'string' && data.message.trim().length > 0) {
        summary = data.message.trim();
      } else if (data.message.content != null && typeof data.message.content === 'string' && data.message.content.trim().length > 0) {
        summary = data.message.content.trim();
      }
    }

    console.log('Terse background: Extracted summary:', summary ? `"${summary.substring(0, 50)}..."` : 'null');
    console.log('Terse background: Summary length:', summary ? summary.length : 0);

    if (!summary || summary.length === 0) {
      console.error('Terse background: No summary found in response.');
      console.error('Terse background: Response structure:', {
        hasChoices: !!data.choices,
        choicesLength: data.choices?.length || 0,
        firstChoiceKeys: data.choices?.[0] ? Object.keys(data.choices[0]) : null,
        firstChoiceMessage: data.choices?.[0]?.message ? Object.keys(data.choices[0].message) : null,
        firstChoiceContent: data.choices?.[0]?.message?.content,
        hasContent: !!data.content,
        hasMessage: !!data.message
      });
      console.error('Terse background: Full response:', JSON.stringify(data, null, 2));
      return {
        success: false,
        error: 'No summary returned from API. The response may be empty or in an unexpected format. Check the extension service worker console (chrome://extensions -> Terse -> Service worker -> Inspect) for details.'
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
