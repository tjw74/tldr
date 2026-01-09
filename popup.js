const DEFAULT_PROMPT = "Extract the core message and most important takeaways from this text. What is the essential information the author wants the reader to know? Focus on the actual content and meaning, not a description of what the text is. Respond in 2-4 short sentences maximum - prioritize only the most critical points that a reader needs to understand.";

// Load settings on popup open
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  
  // Event listeners
  document.getElementById('summarizeBtn').addEventListener('click', summarizePage);
  document.getElementById('saveKeyBtn').addEventListener('click', saveApiKey);
  document.getElementById('removeKeyBtn').addEventListener('click', removeApiKey);
  document.getElementById('toggleKey').addEventListener('click', toggleKeyVisibility);
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('resetPrompt').addEventListener('click', resetPrompt);
});

async function loadSettings() {
  try {
    // Load API key (check both local and session)
    const localData = await chrome.storage.local.get(['apiKey', 'saveKey', 'model', 'prompt']);
    const sessionData = await chrome.storage.session.get(['apiKey']);
    
    if (localData.apiKey) {
      document.getElementById('apiKey').value = localData.apiKey;
      document.getElementById('saveKey').checked = localData.saveKey !== false;
    } else if (sessionData.apiKey) {
      document.getElementById('apiKey').value = sessionData.apiKey;
      document.getElementById('saveKey').checked = false;
    }

    // Load model
    if (localData.model) {
      document.getElementById('model').value = localData.model;
    } else {
      document.getElementById('model').value = 'gpt-5-nano';
    }

    // Load prompt
    if (localData.prompt) {
      document.getElementById('prompt').value = localData.prompt;
    } else {
      document.getElementById('prompt').value = DEFAULT_PROMPT;
    }
  } catch (error) {
    showStatus('Error loading settings', 'error');
  }
}

async function saveApiKey() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const saveKey = document.getElementById('saveKey').checked;

  if (!apiKey) {
    showStatus('Please enter an API key', 'error');
    return;
  }

  try {
    if (saveKey) {
      // Save to persistent storage
      await chrome.storage.local.set({ apiKey, saveKey: true });
      await chrome.storage.session.remove('apiKey');
      showStatus('API key saved (persistent)', 'success');
    } else {
      // Save to session storage
      await chrome.storage.session.set({ apiKey });
      await chrome.storage.local.remove('apiKey');
      showStatus('API key saved (session only)', 'success');
    }
  } catch (error) {
    showStatus('Error saving API key', 'error');
  }
}

async function removeApiKey() {
  try {
    await chrome.storage.local.remove('apiKey');
    await chrome.storage.session.remove('apiKey');
    document.getElementById('apiKey').value = '';
    showStatus('API key removed', 'success');
  } catch (error) {
    showStatus('Error removing API key', 'error');
  }
}

function toggleKeyVisibility() {
  const input = document.getElementById('apiKey');
  const button = document.getElementById('toggleKey');
  if (input.type === 'password') {
    input.type = 'text';
    button.textContent = '🙈';
  } else {
    input.type = 'password';
    button.textContent = '👁';
  }
}

async function saveSettings() {
  const model = document.getElementById('model').value;
  const prompt = document.getElementById('prompt').value.trim();
  const saveKey = document.getElementById('saveKey').checked;

  if (!prompt) {
    showStatus('Prompt cannot be empty', 'error');
    return;
  }

  try {
    const settings = { model, prompt };
    
    // Only save prompt if in persistent mode
    if (saveKey) {
      await chrome.storage.local.set(settings);
      showStatus('Settings saved', 'success');
    } else {
      // In session mode, don't persist prompt
      await chrome.storage.local.set({ model }); // Save model but not prompt
      showStatus('Model saved (prompt not saved in session mode)', 'success');
    }
  } catch (error) {
    showStatus('Error saving settings', 'error');
  }
}

function resetPrompt() {
  document.getElementById('prompt').value = DEFAULT_PROMPT;
  showStatus('Prompt reset to default', 'success');
}

async function summarizePage() {
  // Check if API key exists
  const localData = await chrome.storage.local.get(['apiKey']);
  const sessionData = await chrome.storage.session.get(['apiKey']);
  
  if (!localData.apiKey && !sessionData.apiKey) {
    showStatus('Please configure your API key first', 'error');
    return;
  }

  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      showStatus('Could not access current tab', 'error');
      return;
    }

    // Check if we can inject into this page (chrome:// pages, etc. won't work)
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://'))) {
      showStatus('Cannot summarize this page type', 'error');
      return;
    }

    showStatus('Starting summary...', 'success');

    // Always inject content script and CSS first to ensure they're loaded
    try {
      // Inject CSS
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['styles.css']
      });
      
      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      // Wait a moment for script to initialize
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check if text is selected
      let useSelection = false;
      try {
        const checkResponse = await chrome.tabs.sendMessage(tab.id, { action: 'checkSelection' });
        useSelection = checkResponse && checkResponse.hasSelection;
      } catch (checkError) {
        console.error('Terse popup: Error checking selection:', checkError);
      }
      
      // Trigger summarize
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'summarize',
        useSelection: useSelection
      });

      if (response && response.success) {
        showStatus('Summary generated!', 'success');
        // Close popup after a brief delay
        setTimeout(() => window.close(), 500);
      } else {
        showStatus(response?.error || 'Failed to summarize', 'error');
      }
    } catch (error) {
      console.error('Terse popup error:', error);
      showStatus('Error: ' + error.message, 'error');
    }
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
  }
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  setTimeout(() => {
    status.textContent = '';
    status.className = 'status';
  }, 3000);
}
