const DEFAULT_CONTENT_SETTINGS = {
  obsidianVaultName: 'YourVaultName',
  sidebarWidth: 450 // Default sidebar width in pixels, matches popup.js default
};

// Listen for messages from background script
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('[CONTENT] Received message:', message);
  let sidebar;

  if (message.type === 'OMNISEARCH_RESULTS') {
    await displayOmnisearchResults(message.results, message.query);
  } else if (message.type === 'OMNISEARCH_ERROR') {
    sidebar = await createOmnisearchSidebar();
    const content = sidebar.querySelector('#omnisearch-content');
    if (content) {
      content.innerHTML = `
        <div class="omnisearch-error">
          Error: ${message.error}
          <br><br>
          <small>Make sure Omnisearch is running (default: localhost:51361) and the Kagi-Obsidian Bridge extension settings are correct.</small>
        </div>
      `;
    } else {
      console.error('[CONTENT] #omnisearch-content not found in sidebar for error message.');
    }
  } else {
    // Message not handled by this listener
    return false; // Or undefined, as sendResponse is not used.
  }
  // Indicate that the message was handled (or will be handled asynchronously)
  // This is important if sendResponse were to be used asynchronously.
  return true;
});

// Check on page load
extractKagiQuery();

// Monitor for URL changes (for single-page app navigation)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    extractKagiQuery();
  }
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Extract search query from Kagi URL
function extractKagiQuery() {
  const url = new URL(window.location.href);

  // Kagi uses 'q' parameter for search queries
  const query = url.searchParams.get('q');

  if (query && query.trim()) {
    console.log('Kagi search detected:', query);

    // Send to background script
    browser.runtime.sendMessage({
      type: 'KAGI_SEARCH',
      query: query.trim(),
      url: window.location.href
    }).then(response => {
      console.log('[CONTENT] Message sent successfully:', response);
    }).catch(error => {
      console.error('[CONTENT] Error sending message:', error);
    });
  }
}

// Load CSS file
function loadCSS() {
  if (document.getElementById('omnisearch-styles')) {
    return; // Already loaded
  }

  const link = document.createElement('link');
  link.id = 'omnisearch-styles';
  link.rel = 'stylesheet';
  link.href = browser.runtime.getURL('sidebar/sidebar.css');
  document.head.appendChild(link);
}

// Create sidebar for Omnisearch results
async function createOmnisearchSidebar() {
  const settings = await browser.storage.local.get(DEFAULT_CONTENT_SETTINGS);
  let sidebar = document.getElementById('omnisearch-sidebar');
  
  if (sidebar) {
    loadCSS(); // Ensure CSS is loaded if sidebar somehow exists without CSS
    sidebar.style.width = `${settings.sidebarWidth}px`; // Apply width if sidebar already exists
    return sidebar;
  }

  loadCSS();

  // Default width from settings will be applied after creation

  try {
    const sidebarURL = browser.runtime.getURL('sidebar/sidebar.html');
    const response = await fetch(sidebarURL);
    if (!response.ok) {
      throw new Error(`Failed to load sidebar.html: ${response.status} ${response.statusText}`);
    }
    const html = await response.text();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html.trim(); // html.trim() is important if there's leading/trailing whitespace

    if (!tempDiv.firstChild || tempDiv.firstChild.id !== 'omnisearch-sidebar') {
        console.error(tempDiv.firstChild);
      console.error("Fetched HTML:", html); // Log the fetched HTML for debugging
      throw new Error("Fetched HTML does not contain #omnisearch-sidebar as its root element.");
    }
    sidebar = tempDiv.firstChild;
    sidebar.style.width = `${settings.sidebarWidth}px`; // Apply configured width
    document.body.appendChild(sidebar);

    // Close button functionality - ensure it's queried from the newly added sidebar
    const closeButton = sidebar.querySelector('#omnisearch-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        sidebar.remove();
        const styleLink = document.getElementById('omnisearch-styles');
        if (styleLink) {
          styleLink.remove();
        }
      });
    } else {
      console.warn('#omnisearch-close button not found in loaded sidebar HTML.');
    }
  } catch (error) {
    console.error('Error creating Omnisearch sidebar from HTML:', error);
  }
  return sidebar;
}

// Display Omnisearch results
async function displayOmnisearchResults(results, query) {
  const sidebar = await createOmnisearchSidebar();
  const content = sidebar.querySelector('#omnisearch-content');

  if (!content) {
    console.error("[CONTENT] #omnisearch-content not found in sidebar. Cannot display results.");
    return;
  }

  if (!results || results.length === 0) {
    content.innerHTML = `
      <div style="text-align: center; color: #666; padding: 20px;">
        No notes found for "${query}"
      </div>
    `;
    return;
  }

  const resultsHtml = results.map(result => `
    <div class="omnisearch-result" data-path="${result.path || ''}" title="Path: ${result.path || 'N/A'}">
      <div class="omnisearch-title">${result.basename || 'Untitled'}</div>
      ${result.path ? `<div class="omnisearch-path">${result.path}</div>` : ''}
      <div class="omnisearch-excerpt">${result.excerpt || result.content || ''}</div>
    </div>
  `).join('');

  content.innerHTML = `
    <div class="omnisearch-count">
      Found ${results.length} note${results.length !== 1 ? 's' : ''} for "${query}"
    </div>
    ${resultsHtml}
  `;

  // Add click handlers to open notes in Obsidian
  content.querySelectorAll('.omnisearch-result').forEach(result => {
    result.addEventListener('click', async () => {
      const path = result.dataset.path;
      if (path) {
        try {
          const settings = await browser.storage.local.get(DEFAULT_CONTENT_SETTINGS);
          const obsidianUrl = `obsidian://open?vault=${encodeURIComponent(settings.obsidianVaultName)}&file=${encodeURIComponent(path)}`;
          
          // Use an iframe to trigger the protocol without opening a new persistent tab
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = obsidianUrl;
          document.body.appendChild(iframe);
          
          // Clean up the iframe after a short delay
          setTimeout(() => {
            if (iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
          }, 500); // Delay to allow protocol handler to activate
        } catch (e) {
          console.error("Error opening Obsidian link:", e);
          // Optionally, inform the user that settings could not be loaded
          alert("Could not load Obsidian vault settings. Please check extension settings.");
        }
      }
    });
  });
}