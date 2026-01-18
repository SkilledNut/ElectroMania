import Phaser from "phaser";
import { Theme } from "../ui/theme";

export default class EquationRunnerScene extends Phaser.Scene {
  constructor() {
    super("EquationRunnerScene");
  }

  create() {
    const { width, height } = this.cameras.main;

    // Create background
    this.cameras.main.setBackgroundColor(Theme.colors.background);

    // Create container for the game iframe
    this.createGameContainer();

    // Create back button
    this.createBackButton(width);

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

  returnToLab() {
    // Clean up iframe and button
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
    // Clean up when scene is shut down
    if (this.gameIframe) {
      this.gameIframe.remove();
    }
    if (this.backButton) {
      this.backButton.remove();
    }
  }
}
