import Phaser from "phaser";
import { Theme } from "../ui/theme";
import { config } from "../config";

export default class EquationRunnerScene extends Phaser.Scene {
  constructor() {
    super("EquationRunnerScene");
    this.syncInterval = null;
    this.isShuttingDown = false;
  }

  create() {
    const { width, height } = this.cameras.main;

    // Create background
    this.cameras.main.setBackgroundColor(Theme.colors.background);

    // Create container for the game iframe
    this.createGameContainer();

    // Create back button
    this.createBackButton(width);

    // Start syncing localStorage every minute
    this.startSync();

    // Add escape key listener
    this.input.keyboard.on('keydown-ESC', () => {
      this.returnToLab();
    });
  }

  createGameContainer() {
    // Create iframe element
    const iframe = document.createElement('iframe');
    iframe.id = 'equation-runner-frame';
    iframe.src = '/EquationRunner/index.html';
    iframe.style.position = 'absolute';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.zIndex = '1000';
    iframe.allow = 'autoplay; fullscreen';
    
    // Add iframe to document body
    document.body.appendChild(iframe);
    
    // Store reference for cleanup
    this.gameIframe = iframe;
  }

  createBackButton(width) {
    // Create a DOM button for better visibility over iframe
    const backButton = document.createElement('button');
    backButton.id = 'equation-runner-back-btn';
    backButton.innerHTML = '← Nazaj v laboratorij';
    backButton.style.position = 'absolute';
    backButton.style.top = '20px';
    backButton.style.left = '20px';
    backButton.style.padding = '12px 24px';
    backButton.style.backgroundColor = Theme.colors.primary;
    backButton.style.color = '#ffffff';
    backButton.style.border = 'none';
    backButton.style.borderRadius = '8px';
    backButton.style.fontSize = '16px';
    backButton.style.fontFamily = Theme.fonts.primary;
    backButton.style.cursor = 'pointer';
    backButton.style.zIndex = '1001';
    backButton.style.transition = 'all 0.2s';
    
    backButton.addEventListener('mouseenter', () => {
      backButton.style.backgroundColor = Theme.colors.secondary;
      backButton.style.transform = 'scale(1.05)';
    });
    
    backButton.addEventListener('mouseleave', () => {
      backButton.style.backgroundColor = Theme.colors.primary;
      backButton.style.transform = 'scale(1)';
    });
    
    backButton.addEventListener('click', () => {
      this.returnToLab();
    });
    
    document.body.appendChild(backButton);
    this.backButton = backButton;
  }

  startSync() {
    // Clear Unity localStorage before loading fresh data
    this.clearUnityLocalStorage();
    
    // Load initial data from server
    this.loadGameData();

    // Sync every 60 seconds
    this.syncInterval = setInterval(() => {
      this.syncGameData();
    }, 60000);
  }

  clearUnityLocalStorage() {
    // Clear all Unity-related localStorage entries
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('unity.') || key.includes('EndlessRunner'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`[EquationRunner] Cleared ${keysToRemove.length} Unity localStorage entries`);
  }

  async loadGameData() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${config.API_URL}/equationrunner`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Restore Unity game data to localStorage
        if (data.gameData) {
          Object.keys(data.gameData).forEach(key => {
            if (key.startsWith('unity.') || key.includes('EndlessRunner')) {
              localStorage.setItem(key, data.gameData[key]);
            }
          });
        }
        console.log('[EquationRunner] Game data loaded from server');
      }
    } catch (error) {
      console.error('[EquationRunner] Failed to load game data:', error);
    }
  }

  async syncGameData() {
    if (this.isShuttingDown) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // Capture all Unity-related localStorage data
      const gameData = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // Only sync Unity game data (adjust key pattern as needed)
        if (key && (key.startsWith('unity.') || key.includes('EndlessRunner'))) {
          gameData[key] = localStorage.getItem(key);
        }
      }

      const response = await fetch(`${config.API_URL}/equationrunner/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ gameData })
      });

      if (response.ok) {
        console.log('[EquationRunner] Game data synced successfully');
      }
    } catch (error) {
      console.error('[EquationRunner] Sync failed:', error);
    }
  }

  async returnToLab() {
    this.isShuttingDown = true;

    // Final sync before leaving
    await this.syncGameData();

    // Clear Unity localStorage after syncing
    this.clearUnityLocalStorage();

    // Clean up
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.gameIframe) {
      this.gameIframe.remove();
    }
    if (this.backButton) {
      this.backButton.remove();
    }
    
    // Return to lab scene
    this.scene.start("LabScene");
  }

  shutdown() {
    this.isShuttingDown = true;

    // Stop sync interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Clean up when scene is shut down
    if (this.gameIframe) {
      this.gameIframe.remove();
    }
    if (this.backButton) {
      this.backButton.remove();
    }
  }
}
