// Inject styles if not already injected
function ensureStyles() {
  if (document.getElementById('terse-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'terse-styles';
  style.textContent = `
    #terse-overlay {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 400px;
      animation: terse-slideIn 0.3s ease-out;
    }
    @keyframes terse-slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .terse-overlay-content {
      background-color: #1a1a1a;
      border: 1px solid #333333;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    }
    .terse-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .terse-title {
      font-size: 16px;
      font-weight: 600;
      color: #ffffff;
    }
    .terse-close {
      background: none;
      border: none;
      color: #888888;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .terse-close:hover { color: #ffffff; }
    .terse-summary {
      font-size: 14px;
      line-height: 1.6;
      color: #ffffff;
      margin-bottom: 12px;
      word-wrap: break-word;
    }
    .terse-error {
      font-size: 14px;
      color: #ff8888;
      margin-bottom: 12px;
    }
    .terse-actions { display: flex; gap: 8px; }
    .terse-copy {
      padding: 8px 16px;
      background-color: #ffffff;
      color: #000000;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .terse-copy:hover { background-color: #e0e0e0; }
    .terse-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
    }
    .terse-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #333333;
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: terse-spin 0.8s linear infinite;
      margin-bottom: 12px;
    }
    @keyframes terse-spin {
      to { transform: rotate(360deg); }
    }
    .terse-loading-text {
      font-size: 14px;
      color: #888888;
    }
  `;
  document.head.appendChild(style);
}

// Inject styles on load
ensureStyles();

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'summarize') {
    summarizeText(request.useSelection).then(sendResponse);
    return true; // Keep channel open for async response
  }
  if (request.action === 'checkSelection') {
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().trim().length > 0;
    sendResponse({ hasSelection });
    return true;
  }
});

// Extract text from page
function extractText(useSelection = false) {
  if (useSelection) {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      return selection.toString().trim();
    }
  }
  
  // Extract all visible text from page
  const bodyText = document.body.innerText || document.body.textContent;
  return bodyText.trim();
}

// Show overlay with summary
function showOverlay(summary) {
  // Remove existing overlay if present
  const existing = document.getElementById('terse-overlay');
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'terse-overlay';
  overlay.innerHTML = `
    <div class="terse-overlay-content">
      <div class="terse-header">
        <span class="terse-title">Terse</span>
        <button class="terse-close" id="terse-close">×</button>
      </div>
      <div class="terse-summary" id="terse-summary">${escapeHtml(summary)}</div>
      <div class="terse-actions">
        <button class="terse-copy" id="terse-copy">Copy</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close button
  overlay.querySelector('#terse-close').addEventListener('click', () => {
    overlay.remove();
  });

  // Copy button
  overlay.querySelector('#terse-copy').addEventListener('click', async () => {
    const summaryText = document.getElementById('terse-summary').textContent;
    try {
      await navigator.clipboard.writeText(summaryText);
      const copyBtn = overlay.querySelector('#terse-copy');
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  });

  // Click outside to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

// Show loading overlay
function showLoadingOverlay() {
  const existing = document.getElementById('terse-overlay');
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'terse-overlay';
  overlay.innerHTML = `
    <div class="terse-overlay-content">
      <div class="terse-loading">
        <div class="terse-spinner"></div>
        <div class="terse-loading-text">Summarizing...</div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

// Show error overlay
function showErrorOverlay(message) {
  const existing = document.getElementById('terse-overlay');
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'terse-overlay';
  overlay.innerHTML = `
    <div class="terse-overlay-content">
      <div class="terse-header">
        <span class="terse-title">Terse</span>
        <button class="terse-close" id="terse-close">×</button>
      </div>
      <div class="terse-error">${escapeHtml(message)}</div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#terse-close').addEventListener('click', () => {
    overlay.remove();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

// Main summarize function
async function summarizeText(useSelection = false) {
  try {
    // Show loading state immediately
    showLoadingOverlay();
    console.log('Terse: Starting summarization, useSelection:', useSelection);

    // Extract text
    const text = extractText(useSelection);
    console.log('Terse: Extracted text length:', text ? text.length : 0);
    
    if (!text || text.length === 0) {
      showErrorOverlay('No text found to summarize');
      return { success: false, error: 'No text found' };
    }

    // Send to background script for API call
    console.log('Terse: Sending to background script...');
    const response = await chrome.runtime.sendMessage({
      action: 'summarize',
      text: text
    });

    console.log('Terse: Received response:', response);

    if (!response) {
      showErrorOverlay('No response from extension. Check console for errors.');
      return { success: false, error: 'No response' };
    }

    if (response.success) {
      showOverlay(response.summary);
      return { success: true };
    } else {
      showErrorOverlay(response.error || 'Failed to summarize text');
      return { success: false, error: response.error };
    }
  } catch (error) {
    console.error('Terse error:', error);
    showErrorOverlay('An error occurred: ' + error.message);
    return { success: false, error: error.message };
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
