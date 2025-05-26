const DEFAULT_CONTENT_SETTINGS = {
  obsidianVaultName: 'YourVaultName',
  sidebarWidth: 450 // Default sidebar width in pixels, matches popup.js default
};

// Listen for messages from background script
chrome.runtime.onMessage.addListener(async (message, sender) => {
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
          Error:  <span class="error-message"></span>
          <br><br>
          <small>Make sure Omnisearch is running (default: localhost:51361) and the Kagi-Obsidian Bridge extension settings are correct.</small>
        </div>
      `;
      content.querySelector('.error-message').textContent = message.error;
    } else {
      console.error('[CONTENT] #omnisearch-content not found in sidebar for error message.');
    }
  }
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
    chrome.runtime.sendMessage({
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
  link.href = chrome.runtime.getURL('sidebar/sidebar.css');
  document.head.appendChild(link);
}

// Create sidebar for Omnisearch results
async function createOmnisearchSidebar() {
  const settings = await chrome.storage.local.get(DEFAULT_CONTENT_SETTINGS);
  let sidebar = document.getElementById('omnisearch-sidebar');
  
  if (sidebar) {
    loadCSS(); // Ensure CSS is loaded if sidebar somehow exists without CSS
    sidebar.style.width = `${settings.sidebarWidth}px`; // Apply width if sidebar already exists
    return sidebar;
  }

  loadCSS();

  // Default width from settings will be applied after creation

  try {
    const sidebarURL = chrome.runtime.getURL('sidebar/sidebar.html');
    const response = await fetch(sidebarURL);
    if (!response.ok) {
      throw new Error(`Failed to load sidebar.html: ${response.status} ${response.statusText}`);
    }
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html.trim(), 'text/html');
    sidebar = doc.body.firstChild;
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
        No notes found for <span class="queryText"></span>"
      </div>
    `;
    content.querySelector('.queryText').textContent = query;
    return;
  }

  // Main rendering code
  content.innerHTML = '';

  // Create count element
  const countDiv = document.createElement('div');
  countDiv.className = 'omnisearch-count';
  countDiv.textContent = `Found ${results.length} note${results.length !== 1 ? 's' : ''} for "`;
  const querySpan = document.createElement('span');
  querySpan.className = 'result-count-query';
  querySpan.textContent = query;
  countDiv.appendChild(querySpan);
  countDiv.appendChild(document.createTextNode('"'));
  content.appendChild(countDiv);

  // Create and append result elements
  results.forEach(result => {
    const resultElement = buildSearchResultElement(result);
    content.appendChild(resultElement);
  });
}

function buildSearchResultElement(result) {
  const resultDiv = document.createElement('div');
  resultDiv.className = 'omnisearch-result';
  resultDiv.setAttribute('data-path', result.path || '');
  resultDiv.title = `Path: ${result.path || 'N/A'}`;

  // Create title element
  const titleDiv = document.createElement('div');
  titleDiv.className = 'omnisearch-title';
  titleDiv.textContent = result.basename || 'Untitled';
  resultDiv.appendChild(titleDiv);

  // Create path element (if path exists)
  if (result.path) {
    const pathDiv = document.createElement('div');
    pathDiv.className = 'omnisearch-path';
    pathDiv.textContent = result.path;
    resultDiv.appendChild(pathDiv);
  }

  // Create excerpt element
  const excerptDiv = document.createElement('div');
  excerptDiv.className = 'omnisearch-excerpt';
  excerptDiv.textContent = result.excerpt || result.content || '';
  resultDiv.appendChild(excerptDiv);

  // add on click event to open in obsidian
  resultDiv.addEventListener('click', () => openInObsidian(result.path));

  return resultDiv;
}

async function openInObsidian(path) {
    if (path) {
      try {
        const settings = await chrome.storage.local.get(DEFAULT_CONTENT_SETTINGS);
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
}