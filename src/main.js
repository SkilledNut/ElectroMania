import './style.css'
import Phaser from 'phaser';

// uvoz scen
import UIScene from './scenes/UIScene';
import PreloadScene from './scenes/preloadScene';
import MenuScene from './scenes/menuScene';
import LabScene from './scenes/labScene';
import TestScene from './scenes/testScene';
import LoginScene from './scenes/loginScene';
import ScoreboardScene from './scenes/scoreboardScene';
import WorkspaceScene from './scenes/workspaceScene';

const config = {
  type: Phaser.AUTO,            
  width: window.innerWidth,                    
  height: window.innerHeight,                   
  backgroundColor: '#f4f6fa',    
  parent: 'game-container',      
  scene: [
    // uvoz scen
    MenuScene,
    LabScene,
    WorkspaceScene,
    PreloadScene,
    UIScene,
    TestScene,
    LoginScene,
    ScoreboardScene
  ],
  physics: {
    default: 'arcade',           
    arcade: {
      gravity: { y: 0 },         
      debug: false               
    }
  },
  scale: {
    mode: Phaser.Scale.RESIZE,      
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

// inicializacija igre
const game = new Phaser.Game(config);

// Disable scrolling on the game canvas
window.addEventListener('wheel', (e) => {
  // Check if the event target is the game canvas or within the game container
  if (e.target.tagName === 'CANVAS' || e.target.closest('#game-container')) {
    e.preventDefault();
  }
}, { passive: false });

export default game;