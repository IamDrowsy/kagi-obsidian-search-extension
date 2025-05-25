console.log('🚀 Background script loaded');

const DEFAULT_SETTINGS = {
  omnisearchBaseUrl: 'http://localhost',
  omnisearchPort: 51361,
};

browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('📨 Message received:', message);

  if (message.type === 'KAGI_SEARCH') {
    console.log('🔍 Processing search:', message.query);

    try {
      const settings = await browser.storage.local.get(DEFAULT_SETTINGS);
      
      // Fetch from Omnisearch
      const omnisearchUrl = `${settings.omnisearchBaseUrl}:${settings.omnisearchPort}/search?q=${encodeURIComponent(message.query)}`;
      console.log('🌐 Fetching from:', omnisearchUrl);

      const response = await fetch(omnisearchUrl);
      const results = await response.json();

      console.log('📊 Omnisearch results:', results);

      // Send results back to content script
      browser.tabs.sendMessage(sender.tab.id, {
        type: 'OMNISEARCH_RESULTS',
        results: results || [], // Ensure results is always an array
        query: message.query
      });

    } catch (error) {
      console.error('❌ Error fetching Omnisearch results:', error);

      // Send error back to content script
      browser.tabs.sendMessage(sender.tab.id, {
        type: 'OMNISEARCH_ERROR',
        error: error.message
      });
    }
  }

  return true;
});
