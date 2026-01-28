// Firefox MV2 polyfill: chrome.scripting not available; use chrome.tabs.executeScript/insertCSS
if (typeof chrome !== 'undefined' && !chrome.scripting && chrome.tabs) {
  chrome.scripting = {
    executeScript(opts) {
      const tabId = opts.target?.tabId;
      const file = opts.files?.[0];
      if (!tabId || !file) return Promise.reject(new Error('Invalid arguments'));
      return chrome.tabs.executeScript(tabId, { file });
    },
    insertCSS(opts) {
      const tabId = opts.target?.tabId;
      const file = opts.files?.[0];
      if (!tabId || !file) return Promise.reject(new Error('Invalid arguments'));
      return chrome.tabs.insertCSS(tabId, { file });
    }
  };
}

const DEFAULT_PROMPT = "Extract the core message and most important takeaways from this text. What is the essential information the author wants the reader to know? Focus on the actual content and meaning, not a description of what the text is. Respond in 2-4 short sentences maximum - prioritize only the most critical points that a reader needs to understand.";

// Load settings on popup open
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadCostSummary();
  
  // Event listeners
  document.getElementById('summarizeBtn').addEventListener('click', summarizePage);
  document.getElementById('saveKeyBtn').addEventListener('click', saveApiKey);
  document.getElementById('removeKeyBtn').addEventListener('click', removeApiKey);
  document.getElementById('toggleKey').addEventListener('click', toggleKeyVisibility);
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('resetPrompt').addEventListener('click', resetPrompt);
  
  // Listen for usage updates
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.usageStats) {
      loadCostSummary();
    }
  });
});

async function loadSettings() {
  try {
    // Load API key (check both local and session; session not in older Firefox)
    const localData = await chrome.storage.local.get(['apiKey', 'saveKey', 'model', 'prompt']);
    const sessionData = (chrome.storage && chrome.storage.session)
      ? await chrome.storage.session.get(['apiKey']) : {};
    
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
      await chrome.storage.local.set({ apiKey, saveKey: true });
      if (chrome.storage && chrome.storage.session) await chrome.storage.session.remove('apiKey');
      showStatus('API key saved (persistent)', 'success');
    } else {
      if (chrome.storage && chrome.storage.session) {
        await chrome.storage.session.set({ apiKey });
        await chrome.storage.local.remove('apiKey');
        showStatus('API key saved (session only)', 'success');
      } else {
        await chrome.storage.local.set({ apiKey, saveKey: false });
        showStatus('API key saved (session storage not available)', 'success');
      }
    }
  } catch (error) {
    showStatus('Error saving API key', 'error');
  }
}

async function removeApiKey() {
  try {
    await chrome.storage.local.remove('apiKey');
    if (chrome.storage && chrome.storage.session) await chrome.storage.session.remove('apiKey');
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
  const sessionData = (chrome.storage && chrome.storage.session)
    ? await chrome.storage.session.get(['apiKey']) : {};
  
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

    // Check if we can inject into this page (browser internals, extension pages, etc. won't work)
    const restricted = ['chrome://', 'chrome-extension://', 'edge://', 'moz-extension://', 'about:'];
    if (tab.url && restricted.some(p => tab.url.startsWith(p))) {
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
        // Refresh cost summary to show updated stats
        await loadCostSummary();
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

// Model pricing (must match background.js)
const MODEL_PRICING = {
  'gpt-5.2': { input: 2.50, output: 10.00 },
  'gpt-5.2-pro': { input: 5.00, output: 20.00 },
  'gpt-5-mini': { input: 0.15, output: 0.60 },
  'gpt-5-nano': { input: 0.075, output: 0.30 },
  'gpt-5': { input: 2.50, output: 10.00 },
  'gpt-4.1': { input: 2.50, output: 10.00 },
  'gpt-4.1-mini': { input: 0.15, output: 0.60 },
  'gpt-4.1-nano': { input: 0.075, output: 0.30 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 }
};

async function loadCostSummary() {
  try {
    const data = await chrome.storage.local.get(['usageStats', 'model']);
    const usageStats = data.usageStats || {};
    const currentModel = data.model || 'gpt-5-nano';
    
    console.log('Terse popup: Loading cost summary', { usageStats, currentModel });
    
    // Total stats
    const total = usageStats.total || { requests: 0, totalCost: 0 };
    document.getElementById('totalRequests').textContent = total.requests || 0;
    document.getElementById('totalCost').textContent = formatCost(total.totalCost || 0);
    
    // Current model cost per 1M tokens
    const pricing = MODEL_PRICING[currentModel] || MODEL_PRICING['gpt-3.5-turbo'];
    document.getElementById('currentModelCost').textContent = 
      `$${pricing.input.toFixed(3)}/$1M input, $${pricing.output.toFixed(3)}/$1M output`;
    
    // Last request cost
    const modelStats = usageStats[currentModel];
    if (modelStats && modelStats.lastRequestCost !== undefined) {
      document.getElementById('lastRequestCost').textContent = formatCost(modelStats.lastRequestCost);
    } else {
      document.getElementById('lastRequestCost').textContent = '-';
    }
    
    // Model breakdown
    const breakdown = document.getElementById('modelBreakdown');
    breakdown.innerHTML = '';
    
    // Sort models by total cost (descending)
    const modelEntries = Object.entries(usageStats)
      .filter(([key]) => key !== 'total')
      .sort((a, b) => (b[1].totalCost || 0) - (a[1].totalCost || 0));
    
    if (modelEntries.length === 0) {
      breakdown.innerHTML = '<div class="cost-help-text">No usage data yet</div>';
    } else {
      modelEntries.forEach(([model, stats]) => {
        const item = document.createElement('div');
        item.className = 'model-breakdown-item';
        item.innerHTML = `
          <div class="model-name">${model}</div>
          <div class="model-stats">
            <span>${stats.requests || 0} requests</span>
            <span>${formatCost(stats.totalCost || 0)}</span>
          </div>
        `;
        breakdown.appendChild(item);
      });
    }
  } catch (error) {
    console.error('Error loading cost summary:', error);
  }
}

function formatCost(cost) {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
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
