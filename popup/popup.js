document.addEventListener('DOMContentLoaded', async () => {
  const DEFAULT_SETTINGS = {
    omnisearchBaseUrl: 'http://localhost',
    omnisearchPort: 51361,
    obsidianVaultName: 'YourVaultName',
    sidebarWidth: 450 // Default sidebar width in pixels
  };

  const form = document.getElementById('settings-form');
  const baseUrlInput = document.getElementById('omnisearch-base-url');
  const portInput = document.getElementById('omnisearch-port');
  const vaultInput = document.getElementById('obsidian-vault');
  const statusMessage = document.getElementById('status-message');
  const sidebarWidthInput = document.getElementById('sidebar-width');

  // Load saved settings or defaults
  try {
    const data = await chrome.storage.local.get(DEFAULT_SETTINGS);
    baseUrlInput.value = data.omnisearchBaseUrl;
    portInput.value = data.omnisearchPort;
    vaultInput.value = data.obsidianVaultName;
    sidebarWidthInput.value = data.sidebarWidth;
  } catch (e) {
    console.error("Error loading settings:", e);
    statusMessage.textContent = "Error loading settings.";
    statusMessage.style.color = 'red';
    // Populate with defaults if error during load
    baseUrlInput.value = DEFAULT_SETTINGS.omnisearchBaseUrl;
    portInput.value = DEFAULT_SETTINGS.omnisearchPort;
    vaultInput.value = DEFAULT_SETTINGS.obsidianVaultName;
    sidebarWidthInput.value = DEFAULT_SETTINGS.sidebarWidth;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusMessage.textContent = ''; // Clear previous messages

    const newBaseUrl = baseUrlInput.value.trim();
    const newPort = parseInt(portInput.value, 10);
    const newVaultName = vaultInput.value.trim();
    const newSidebarWidth = parseInt(sidebarWidthInput.value, 10);

    if (!newBaseUrl || !newVaultName || 
        isNaN(newPort) || newPort <= 0 || newPort > 65535 ||
        isNaN(newSidebarWidth) || newSidebarWidth < 200 || newSidebarWidth > 1200) { // Example range for width
      statusMessage.textContent = 'Please fill all fields correctly. Port: 1-65535. Sidebar Width: 200-1200px.';
      statusMessage.style.color = 'red';
      return;
    }

    const newSettings = {
      omnisearchBaseUrl: newBaseUrl,
      omnisearchPort: newPort,
      obsidianVaultName: newVaultName,
      sidebarWidth: newSidebarWidth
    };

    try {
      await chrome.storage.local.set(newSettings);
      statusMessage.textContent = 'Settings saved successfully!';
      statusMessage.style.color = 'green';
      setTimeout(() => {
        statusMessage.textContent = '';
      }, 3000); // Clear after 3 seconds
    } catch (e) {
      console.error("Error saving settings:", e);
      statusMessage.textContent = "Error saving settings. Check browser console for details.";
      statusMessage.style.color = 'red';
    }
  });
});