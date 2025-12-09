import Phaser from "phaser";
import LabScene from "./labScene";
import { Battery } from "../components/battery";
import { Bulb } from "../components/bulb";
import { Wire, WIRE_COLORS } from "../components/wire";
import { CircuitGraph } from "../logic/circuit_graph";
import { Node } from "../logic/node";
import { Switch } from "../components/switch";
import { Resistor } from "../components/resistor";
import { LED, LED_COLORS } from "../components/led";
import { Fuse } from "../components/fuse";
import { config } from "../config";

export default class WorkspaceScene extends Phaser.Scene {
  constructor() {
    super("WorkspaceScene");
    this.currentlyDraggedComponent = null;
    this.circuitCurrent = 0;
    this.activePlacementType = null;
    this.activePlacementColor = null;
    this.activePanelComponent = null;
    this.placementPreview = null;
    this.pendingPlacement = null;
    this.isPlacingNewComponent = false;
    this.previewRotation = 0;
    this.dialogCooldown = false;
  }

  init(data) {
    // Mode can be 'challenge' or 'sandbox'
    this.mode = data?.mode || 'challenge';
    this.isSandboxMode = this.mode === 'sandbox';
    
    if (this.mode === 'challenge') {
      const savedIndex = localStorage.getItem("currentChallengeIndex");
      this.currentChallengeIndex = savedIndex !== null ? parseInt(savedIndex) : 0;
    }

    // Infinite canvas settings for both modes
    this.canvasWidth = 10000;
    this.canvasHeight = 10000;
    
    // Current challenge (will be populated from API)
    this.currentChallenge = null;
    this.challengeLoaded = false;
  }

  async fetchCurrentChallenge() {
    try {
      const token = localStorage.getItem("token");
      const headers = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Fetch single challenge by index (the API accepts order index as id)
      const response = await fetch(`${config.API_URL}/challenges/${this.currentChallengeIndex}`, { headers });
      
      if (response.status === 404) {
        // No more challenges - user completed all
        this.currentChallenge = null;
        this.challengeLoaded = true;
        if (this.promptText) {
          this.promptText.setText("Vse naloge so uspešno opravljene! Čestitke!");
        }
        if (this.missingText) {
          this.missingText.setText("");
        }
        console.log('[WorkspaceScene] All challenges completed!');
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch challenge');
      }
      
      const challenge = await response.json();
      this.currentChallenge = challenge;
      this.challengeLoaded = true;
      
      // Update prompt text if in challenge mode
      if (this.mode === 'challenge' && this.promptText && this.currentChallenge) {
        this.promptText.setText(this.currentChallenge.prompt);
        this.updateMissingLabel();
      }
      
      console.log('[WorkspaceScene] Loaded challenge:', this.currentChallenge.prompt);
    } catch (error) {
      console.error('[WorkspaceScene] Error fetching challenge:', error);
      // Show error message - challenges must be fetched from API
      this.currentChallenge = null;
      this.challengeLoaded = true;
      if (this.promptText) {
        this.promptText.setText("Napaka pri nalaganju naloge. Preverite povezavo s strežnikom.");
      }
      if (this.missingText) {
        this.missingText.setText("");
      }
    }
  }

  async completeCurrentChallenge(score = 10) {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.warn('[WorkspaceScene] No token, cannot complete challenge on server');
        return false;
      }
      
      if (!this.currentChallenge || !this.currentChallenge._id) {
        console.warn('[WorkspaceScene] No valid challenge to complete');
        return false;
      }
      
      const response = await fetch(`${config.API_URL}/challenges/${this.currentChallenge._id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ score })
      });
      
      if (!response.ok) {
        throw new Error('Failed to complete challenge');
      }
      
      const result = await response.json();
      console.log('[WorkspaceScene] Challenge completed:', result);
      
      // Update local storage with server's currentChallengeIndex
      if (result.currentChallengeIndex !== undefined) {
        localStorage.setItem("currentChallengeIndex", result.currentChallengeIndex.toString());
        this.currentChallengeIndex = result.currentChallengeIndex;
      }
      return true;
    } catch (error) {
      console.error('[WorkspaceScene] Error completing challenge:', error);
      return false;
    }
  }

  preload() {
    this.graph = new CircuitGraph();
    this.load.image("baterija", "src/components/battery.png");
    this.load.image("upor", "src/components/resistor.png");
    this.load.image("svetilka", "src/components/lamp.png");
    this.load.image("stikalo-on", "src/components/switch-on.png");
    this.load.image("stikalo-off", "src/components/switch-off.png");
    this.load.image("žica", "src/components/wire.png");
    this.load.image("ammeter", "src/components/ammeter.png");
    this.load.image("voltmeter", "src/components/voltmeter.png");
    this.load.image("led", "src/components/led.svg");
    this.load.image("fuse", "src/components/fuse.png");
  }

  create() {
    const { width, height } = this.cameras.main;

    // Initialize resize timer
    this.resizeTimer = null;

    // Add resize listener with proper cleanup
    this.scale.on('resize', this.handleResize, this);
    
    // Clean up on scene shutdown
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.handleResize, this);
      if (this.resizeTimer) {
        clearTimeout(this.resizeTimer);
      }
    });

    // Set camera bounds to infinite canvas
    this.cameras.main.setBounds(0, 0, this.canvasWidth, this.canvasHeight);
    this.cameras.main.setZoom(1);

    // Center camera initially
    this.cameras.main.scrollX = (this.canvasWidth - width) / 2;
    this.cameras.main.scrollY = (this.canvasHeight - height) / 2;

    // Create infinite background with desk and grid
    const desk = this.add.rectangle(
      this.canvasWidth / 2,
      this.canvasHeight / 2,
      this.canvasWidth,
      this.canvasHeight,
      0xe0c9a6
    );

    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x8b7355, 0.35);
    const gridSize = 40;
    for (let x = 0; x < this.canvasWidth; x += gridSize) {
      gridGraphics.beginPath();
      gridGraphics.moveTo(x, 0);
      gridGraphics.lineTo(x, this.canvasHeight);
      gridGraphics.strokePath();
    }
    for (let y = 0; y < this.canvasHeight; y += gridSize) {
      gridGraphics.beginPath();
      gridGraphics.moveTo(0, y);
      gridGraphics.lineTo(this.canvasWidth, y);
      gridGraphics.strokePath();
    }

    this.infoWindow = this.add.container(0, 0);
    this.infoWindow.setDepth(1000);
    this.infoWindow.setVisible(false);
    this.infoWindow.setScrollFactor(0); // Fixed to camera

    // ozadje info okna
    const infoBox = this.add.rectangle(0, 0, 200, 80, 0x2c2c2c, 0.95);
    infoBox.setStrokeStyle(2, 0xffffff);
    const infoText = this.add
      .text(0, 0, "", {
        fontSize: "14px",
        color: "#ffffff",
        align: "left",
        wordWrap: { width: 180 },
      })
      .setOrigin(0.5);

    this.infoWindow.add([infoBox, infoText]);
    this.infoText = infoText;

    // Fetch current challenge from API if in challenge mode
    if (this.mode === 'challenge') {
      this.fetchCurrentChallenge();
    }

    // Challenges are fetched from the database via API
    // this.challenges is no longer hardcoded

    // this.currentChallengeIndex = 0;

    // Create mode-specific UI elements
    if (this.mode === 'challenge') {
      this.promptText = this.add
        .text(
          width / 1.8,
          height - 30,
          "Nalaganje nalog...",
          {
            fontSize: "20px",
            color: "#333",
            fontStyle: "bold",
            backgroundColor: "#ffffff88",
            padding: { x: 15, y: 8 },
          }
        )
        .setOrigin(0.5)
        .setScrollFactor(0);
    }

    this.checkText = this.add
      .text(width / 2, this.mode === 'sandbox' ? 70 : height - 70, "", {
        fontSize: "18px",
        color: "#cc0000",
        fontStyle: "bold",
        padding: { x: 15, y: 8 },
        backgroundColor: this.mode === 'sandbox' ? "#ffffff88" : "",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    if (this.mode === 'challenge') {
      this.missingText = this.add
        .text(width / 2, height - 100, "", {
          fontSize: "14px",
          color: "#146c9fff",
          fontStyle: "bold",
          padding: { x: 15, y: 8 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0);
    }

    const buttonWidth = 180;
    const buttonHeight = 45;
    const cornerRadius = 10;

    // Store buttons for repositioning on resize
    this.uiButtons = [];
    
    const makeButton = (xOffset, y, label, onClick) => {
      const x = width - xOffset;
      const bg = this.add.graphics();
      bg.fillStyle(0x3399ff, 1);
      bg.fillRoundedRect(
        x - buttonWidth / 2,
        y - buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        cornerRadius
      );
      bg.setScrollFactor(0);
      bg.setDepth(850);

      const text = this.add
        .text(x, y, label, {
          fontFamily: "Arial",
          fontSize: "20px",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(851)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => {
          const currentX = text.x;
          bg.clear();
          bg.fillStyle(0x0f5cad, 1);
          bg.fillRoundedRect(
            currentX - buttonWidth / 2,
            y - buttonHeight / 2,
            buttonWidth,
            buttonHeight,
            cornerRadius
          );
        })
        .on("pointerout", () => {
          const currentX = text.x;
          bg.clear();
          bg.fillStyle(0x3399ff, 1);
          bg.fillRoundedRect(
            currentX - buttonWidth / 2,
            y - buttonHeight / 2,
            buttonWidth,
            buttonHeight,
            cornerRadius
          );
        })
        .on("pointerdown", onClick);

      const button = { bg, text, xOffset, y };
      this.uiButtons.push(button);
      return button;
    };

    makeButton(140, 75, "Lestvica", () =>
      this.scene.start("ScoreboardScene", { cameFromMenu: false })
    );
    makeButton(140, 125, "Preveri krog", () => this.checkCircuit());
    
    // Sandbox buttons - only show in sandbox mode
    if (this.isSandboxMode) {
      makeButton(140, 190, "Shrani", () => this.showSaveDialog());
      makeButton(140, 245, "Naloži", () => this.showLoadDialog());
      makeButton(140, 300, "Počisti", () => this.clearSandbox());
    }

    // stranska vrstica na levi
    const panelWidth = 150;
    this.panelWidth = panelWidth;
    this.leftPanel = this.add.rectangle(0, 0, panelWidth, height, 0xc0c0c0).setOrigin(0).setScrollFactor(0).setDepth(800);
    this.leftPanelOverlay = this.add.rectangle(0, 0, panelWidth, height, 0x000000, 0.2).setOrigin(0).setScrollFactor(0).setDepth(801);

    this.add
      .text(panelWidth / 2, 55, "Komponente", {
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(802);

    // Scrollable panel setup
    this.panelScrollY = 0;
    this.panelMinScroll = 0;
    const componentSpacing = 100;
    const componentStartY = 95;
    const numComponents = 9;
    const totalContentHeight = componentStartY + (numComponents * componentSpacing);
    this.panelMaxScroll = Math.max(0, totalContentHeight - height + 50);
    
    // Create a container for scrollable panel components
    this.panelContainer = this.add.container(0, 0).setDepth(803).setScrollFactor(0);
    
    // komponente v stranski vrstici (inside scrollable container)
    const panelComponents = [
      { y: componentStartY, type: "baterija", color: 0xffcc00 },
      { y: componentStartY + componentSpacing * 1, type: "upor", color: 0xff6600 },
      { y: componentStartY + componentSpacing * 2, type: "svetilka", color: 0xff0000 },
      { y: componentStartY + componentSpacing * 3, type: "stikalo-off", color: 0x666666 },
      { y: componentStartY + componentSpacing * 4, type: "žica", color: 0x0066cc },
      { y: componentStartY + componentSpacing * 5, type: "ammeter", color: 0x00cc66 },
      { y: componentStartY + componentSpacing * 6, type: "voltmeter", color: 0x00cc66 },
      { y: componentStartY + componentSpacing * 7, type: "led", color: 0xff3333 },
      { y: componentStartY + componentSpacing * 8, type: "fuse", color: 0xcccccc },
    ];
    
    this.panelComponentObjects = [];
    for (const comp of panelComponents) {
      const compObj = this.createComponent(panelWidth / 2, comp.y, comp.type, comp.color, { isInPanel: true });
      this.panelComponentObjects.push(compObj);
    }

    // Add scroll indicators
    this.scrollUpIndicator = this.add.text(panelWidth / 2, 80, "▲", {
      fontSize: "16px",
      color: "#ffffff",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(810).setAlpha(0);
    
    this.scrollDownIndicator = this.add.text(panelWidth / 2, height - 15, "▼", {
      fontSize: "16px",
      color: "#ffffff",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(810).setAlpha(0);

    // Mouse wheel scroll handler for left panel
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      // Only scroll if mouse is over the left panel
      if (pointer.x < panelWidth) {
        this.panelScrollY += deltaY * 0.5;
        this.panelScrollY = Phaser.Math.Clamp(this.panelScrollY, this.panelMinScroll, this.panelMaxScroll);
        this.updatePanelScroll();
      }
    });

    // Update scroll indicators visibility
    this.updatePanelScroll();

    this.backButton = this.add
      .text(12, 10, "↩ Nazaj", {
        fontFamily: "Arial",
        fontSize: "20px",
        color: "#387affff",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(900)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.backButton.setStyle({ color: "#0054fdff" }))
      .on("pointerout", () => this.backButton.setStyle({ color: "#387affff" }))
      .on("pointerdown", () => {
        this.cameras.main.fade(300, 0, 0, 0);
        this.time.delayedCall(300, () => {
          this.scene.start(this.mode === 'sandbox' ? "MenuScene" : "LabScene");
        });
      });

    // Mode-specific title
    const titleText = this.mode === 'sandbox' 
      ? "Sandbox način - Povleci zemljevid s srednjo tipko miške"
      : "Povleci komponente na mizo in zgradi svoj električni krog!";
    
    this.titleText = this.add
      .text(
        width / 2 + 50,
        30,
        titleText,
        {
          fontSize: "20px",
          color: "#333",
          fontStyle: "bold",
          align: "center",
          backgroundColor: "#ffffff88",
          padding: { x: 15, y: 8 },
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(900);

    // shrani komponente na mizi
    this.placedComponents = [];
    this.gridSize = 40;

    // Create graphics layer for electricity visualization
    this.electricityGraphics = this.add.graphics();
    this.electricityGraphics.setDepth(5); // Above components
    this.electricityParticles = [];
    this.electricityTimers = [];

    // Setup camera dragging (works in both modes)
    this.setupCameraDragging();

    // Create minimap for navigation
    this.createMinimap();

    // Helper function for rotation
    const rotateComponent = (component, direction) => {
  if (!component) return;

  // Get current rotation and calculate new rotation
  const currentRotation = component.getData("rotation") || 0;
  const newRotation = (currentRotation + direction * 90 + 360) % 360;
  
  component.setData("rotation", newRotation);
  component.setData("isRotated", !component.getData("isRotated"));

  // Check if this is a pending placement - if so, rotate instantly
  const isPendingPlacement = (component === this.pendingPlacement);

  if (isPendingPlacement) {
    // Instant rotation for pending placement
    component.angle = newRotation;
    this.updateLogicNodePositions(component);
  } else {
    // Calculate the shortest rotation path for placed components
    let targetAngle = newRotation;
    const currentAngle = component.angle;
    
    // Normalize current angle to 0-360 range
    const normalizedCurrent = ((currentAngle % 360) + 360) % 360;
    
    // Calculate both clockwise and counter-clockwise distances
    let clockwiseDist = (targetAngle - normalizedCurrent + 360) % 360;
    let counterClockwiseDist = (normalizedCurrent - targetAngle + 360) % 360;
    
    // Choose the shortest path
    if (counterClockwiseDist < clockwiseDist) {
      targetAngle = currentAngle - counterClockwiseDist;
    } else {
      targetAngle = currentAngle + clockwiseDist;
    }

    this.tweens.add({
      targets: component,
      angle: targetAngle,
      duration: 150,
      ease: "Cubic.easeOut",
      onComplete: () => {
        // Normalize the final angle to 0-360 to prevent drift
        component.angle = newRotation;
        this.updateLogicNodePositions(component);
        this.rebuildGraph();
      },
    });
  }
};

    // Setup keyboard input for rotation - Q = left, R = right
    this.input.keyboard.on("keydown-Q", () => {
      // Prioritize preview rotation in placement mode
      if (this.activePlacementType && !this.pendingPlacement) {
        this.previewRotation = (this.previewRotation - 90 + 360) % 360;
        if (this.placementPreview) {
          this.placementPreview.setAngle(this.previewRotation);
        }
        return;
      }

      // Prioritize pending placement component
      if (this.pendingPlacement) {
        rotateComponent.call(this, this.pendingPlacement, -1);
        return;
      }

      // Prioritize currently dragged component
      const targetComponent = this.currentlyDraggedComponent;

      if (targetComponent) {
        rotateComponent.call(this, targetComponent, -1);
        return;
      }

      // Fallback: find component under pointer if not dragging
      const pointer = this.input.activePointer;
      const worldX = pointer.worldX;
      const worldY = pointer.worldY;

      for (const component of this.placedComponents) {
        if (component.getData("isInPanel")) continue;

        const bounds = component.getBounds();
        if (bounds.contains(worldX, worldY)) {
          rotateComponent.call(this, component, -1);
          break;
        }
      }
    });

    this.input.keyboard.on("keydown-R", () => {
      // Prioritize preview rotation in placement mode
      if (this.activePlacementType && !this.pendingPlacement) {
        this.previewRotation = (this.previewRotation + 90) % 360;
        if (this.placementPreview) {
          this.placementPreview.setAngle(this.previewRotation);
        }
        return;
      }

      // Prioritize pending placement component
      if (this.pendingPlacement) {
        rotateComponent.call(this, this.pendingPlacement, 1);
        return;
      }

      // Prioritize currently dragged component
      const targetComponent = this.currentlyDraggedComponent;

      if (targetComponent) {
        rotateComponent.call(this, targetComponent, 1);
        return;
      }

      // Fallback: find component under pointer if not dragging
      const pointer = this.input.activePointer;
      const worldX = pointer.worldX;
      const worldY = pointer.worldY;

      for (const component of this.placedComponents) {
        if (component.getData("isInPanel")) continue;

        const bounds = component.getBounds();
        if (bounds.contains(worldX, worldY)) {
          rotateComponent.call(this, component, 1);
          break;
        }
      }
    });

    // const scoreButton = this.add.text(this.scale.width / 1.1, 25, 'Lestvica', {
    //   fontFamily: 'Arial',
    //   fontSize: '18px',
    //   color: '#0066ff',
    //   backgroundColor: '#e1e9ff',
    //   padding: { x: 20, y: 10 }
    // })
    //   .setOrigin(0.5)
    //   .setInteractive({ useHandCursor: true })
    //   .on('pointerover', () => scoreButton.setStyle({ color: '#0044cc' }))
    //   .on('pointerout', () => scoreButton.setStyle({ color: '#0066ff' }))
    //   .on('pointerdown', () => {
    //     this.scene.start('ScoreboardScene');
    //   });

    // const simulate = this.add.text(this.scale.width / 1.1, 25, 'Simulacija', {
    //   fontFamily: 'Arial',
    //   fontSize: '18px',
    //   color: '#0066ff',
    //   backgroundColor: '#e1e9ff',
    //   padding: { x: 20, y: 10 }
    // })
    //   .setOrigin(0.5, -1)
    //   .setInteractive({ useHandCursor: true })
    //   .on('pointerover', () => simulate.setStyle({ color: '#0044cc' }))
    //   .on('pointerout', () => simulate.setStyle({ color: '#0066ff' }))
    //   .on('pointerdown', () => {
    //     console.log(this.graph);
    //     this.graph.simulate();
    //   });

    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.keyboard.on("keydown-ESC", () => {
      this.deactivatePlacementMode();
    });

    // Press Space to jump to nearest component
    this.input.keyboard.on("keydown-SPACE", (event) => {
      event.preventDefault();
      this.jumpToNearestComponent();
    });

    // Create grid highlight graphics
    this.gridHighlightGraphics = this.add.graphics();
    this.gridHighlightGraphics.setDepth(3);

    // Create connection point graphics
    this.connectionPointGraphics = this.add.graphics();
    this.connectionPointGraphics.setDepth(4);

    // Setup camera dragging with middle mouse button
    this.setupCameraDragging();

    console.log(JSON.parse(localStorage.getItem("users")));
  }

  update() {
    // Update minimap every frame
    this.updateMinimap();
  }

  handlePointerMove(pointer) {
    this.updatePlacementPreview(pointer);

    if (this.isPlacingNewComponent && this.pendingPlacement) {
      const snapped = this.snapToGrid(pointer.worldX, pointer.worldY);
      this.pendingPlacement.x = snapped.x;
      this.pendingPlacement.y = snapped.y;
      this.updateLogicNodePositions(this.pendingPlacement);
      
      // Update grid highlights and connection points for all components
      this.updateGridHighlights(snapped.x, snapped.y);
      if (this.activePlacementType === "žica") {
        this.updateConnectionPoints(snapped.x, snapped.y);
      }
    }
  }

  handlePointerDown(pointer, currentlyOver) {
    if (!this.activePlacementType || !pointer.leftButtonDown()) return;
    if (!this.isPointerOverWorkbench(pointer)) return;
    if (this.isPlacingNewComponent || this.pendingPlacement) return;

    const allowOverlapPlacement = pointer.event && (pointer.event.shiftKey || pointer.event.altKey);
    const overWorkbenchComponent = (currentlyOver || []).some((gameObject) => {
      const container = this.resolveComponentContainer(gameObject);
      return container && !container.getData("isInPanel");
    });

    if (overWorkbenchComponent && !allowOverlapPlacement) return;

    this.beginComponentPlacement(pointer);
  }

  handlePointerUp(pointer) {
    if (!this.isPlacingNewComponent || !this.pendingPlacement) return;
    if (pointer.button !== 0) {
      this.cancelPendingPlacement();
      this.updatePlacementPreview(pointer);
      return;
    }

    if (!this.isPointerOverWorkbench(pointer)) {
      this.cancelPendingPlacement();
      this.updatePlacementPreview(pointer);
      return;
    }

    // Check if placing a component on top of another component of the same type
    const snapped = this.snapToGrid(pointer.worldX, pointer.worldY);
    const hasComponentAtPosition = this.hasComponentAtPosition(snapped.x, snapped.y, this.activePlacementType, this.previewRotation);
    
    if (hasComponentAtPosition) {
      // Show visual feedback that placement is blocked
      this.showPlacementBlockedFeedback(snapped.x, snapped.y);
      return;
    }

    this.finalizeComponentPlacement(pointer);
  }

  togglePlacementMode(panelComponent) {
    if (!panelComponent) return;

    if (this.activePanelComponent === panelComponent) {
      this.deactivatePlacementMode();
    } else {
      this.activatePlacementMode(panelComponent);
    }
  }

  activatePlacementMode(panelComponent) {
    if (!panelComponent) return;

    this.deactivatePlacementMode();

    this.activePlacementType = panelComponent.getData("type");
    this.activePlacementColor = panelComponent.getData("color");
    this.activePanelComponent = panelComponent;
    this.previewRotation = 0;

    this.highlightPanelComponent(panelComponent, true);
    this.createPlacementPreview(this.activePlacementType);
    if (this.input && this.input.activePointer) {
      this.updatePlacementPreview(this.input.activePointer);
    }
  }

  deactivatePlacementMode() {
    this.cancelPendingPlacement();

    if (this.activePanelComponent) {
      this.highlightPanelComponent(this.activePanelComponent, false);
      this.activePanelComponent = null;
    }

    this.activePlacementType = null;
    this.activePlacementColor = null;

    if (this.placementPreview) {
      this.placementPreview.destroy();
      this.placementPreview = null;
    }

    // Clear wire-specific visual feedback
    this.clearGridHighlights();
    this.clearConnectionPoints();
  }

  highlightPanelComponent(component, shouldHighlight) {
    if (!component) return;

    const image = component.getData("componentImage") || component.list?.[0];
    if (!image) return;

    if (shouldHighlight) {
      image.setTint(0xffff99);
    } else {
      image.clearTint();
    }
  }

  createPlacementPreview(type) {
    const textureKey = this.getTextureKeyForType(type);
    if (!textureKey) return;

    if (this.placementPreview) {
      this.placementPreview.destroy();
      this.placementPreview = null;
    }

    this.placementPreview = this.add.image(0, 0, textureKey);
    this.placementPreview.setOrigin(0.5);
    this.placementPreview.setDisplaySize(100, 100);
    this.placementPreview.setAlpha(0.35);
    this.placementPreview.setDepth(900);
    this.placementPreview.setVisible(false);
  }

  updatePlacementPreview(pointer) {
    if (!this.placementPreview) return;

    if (!this.activePlacementType || !this.isPointerOverWorkbench(pointer)) {
      this.placementPreview.setVisible(false);
      return;
    }

    const snapped = this.snapToGrid(pointer.worldX, pointer.worldY);
    this.placementPreview.setPosition(snapped.x, snapped.y);
    this.placementPreview.setAngle(this.previewRotation);
    this.placementPreview.setVisible(true);
  }

  beginComponentPlacement(pointer) {
    const snapped = this.snapToGrid(pointer.worldX, pointer.worldY);
    const color = this.activePlacementColor ?? 0xffffff;

    const component = this.createComponent(
      snapped.x,
      snapped.y,
      this.activePlacementType,
      color,
      { isInPanel: false }
    );

    component.setAlpha(0.7);
    if (component.input) {
      component.input.enabled = false;
    }
    
    // Apply preview rotation to the component
    component.setAngle(this.previewRotation);
    component.setData("rotation", this.previewRotation);
    this.updateLogicNodePositions(component);
    
    // Add visual feedback for wires
    if (this.activePlacementType === "žica") {
      const componentImage = component.getData("componentImage") || component.list[0];
      if (componentImage) {
        componentImage.setTint(0x00ff00); // Green tint while placing
      }
    }
    
    this.pendingPlacement = component;
    this.isPlacingNewComponent = true;

    if (this.placementPreview) {
      this.placementPreview.setVisible(false);
    }
  }

  finalizeComponentPlacement(pointer) {
    if (!this.pendingPlacement) return;

    const snapped = this.snapToGrid(pointer.worldX, pointer.worldY);
    this.pendingPlacement.x = snapped.x;
    this.pendingPlacement.y = snapped.y;
    if (this.pendingPlacement.input) {
      this.pendingPlacement.input.enabled = true;
    }
    this.pendingPlacement.setAlpha(1);
    this.pendingPlacement.setData("isInPanel", false);

    // Remove green tint for wires
    if (this.activePlacementType === "žica") {
      const componentImage = this.pendingPlacement.getData("componentImage") || this.pendingPlacement.list[0];
      if (componentImage) {
        componentImage.clearTint();
      }
      // Show success feedback
      this.showPlacementFeedback(snapped.x, snapped.y);
    }

    if (!this.placedComponents.includes(this.pendingPlacement)) {
      this.placedComponents.push(this.pendingPlacement);
    }
    this.updateLogicNodePositions(this.pendingPlacement);
    this.rebuildGraph();

    this.pendingPlacement = null;
    this.isPlacingNewComponent = false;

    this.updatePlacementPreview(pointer);
  }

  cancelPendingPlacement() {
    if (!this.pendingPlacement) return;

    this.pendingPlacement.destroy();
    this.pendingPlacement = null;
    this.isPlacingNewComponent = false;
  }

  isPointerOverWorkbench(pointer) {
    const boundary = Math.max(this.panelWidth ?? 0, 200);
    return pointer.worldX >= boundary;
  }

  resolveComponentContainer(gameObject) {
    if (!gameObject) return null;
    if (gameObject.getData && gameObject.getData("type")) return gameObject;
    if (gameObject.parentContainer) {
      return this.resolveComponentContainer(gameObject.parentContainer);
    }
    return null;
  }

  getTextureKeyForType(type) {
    const textureMap = {
      baterija: "baterija",
      upor: "upor",
      svetilka: "svetilka",
      "stikalo-on": "stikalo-on",
      "stikalo-off": "stikalo-off",
      "žica": "žica",
      ammeter: "ammeter",
      voltmeter: "voltmeter",
    };
    return textureMap[type] || null;
  }

  handlePanelComponentPointerUp(component, pointer) {
    if (!component) return;

    // Check if this was a drag or a click
    const dragStartX = component.getData("dragStartX");
    const dragStartY = component.getData("dragStartY");
    
    // If drag start position is set, check if component actually moved
    if (dragStartX !== undefined && dragStartY !== undefined) {
      const dx = Math.abs(component.x - dragStartX);
      const dy = Math.abs(component.y - dragStartY);
      const totalMove = Math.hypot(dx, dy);
      
      // If moved more than threshold, it was a drag, not a click
      if (totalMove > 10) {
        return;
      }
    }

    const clickDuration =
      (pointer.upTime || this.time.now) - (pointer.downTime || 0);
    const dx = (pointer.downX || 0) - (pointer.x || 0);
    const dy = (pointer.downY || 0) - (pointer.y || 0);
    const moved = Math.hypot(dx, dy);

    const CLICK_MS_THRESHOLD = 300;
    const MOVE_PX_THRESHOLD = 10;

    if (clickDuration <= CLICK_MS_THRESHOLD && moved <= MOVE_PX_THRESHOLD) {
      this.togglePlacementMode(component);
    }
  }

  /**
   * Highlight the grid cell where the wire will be placed
   */
  updateGridHighlights(x, y) {
    this.clearGridHighlights();
    
    if (!this.gridHighlightGraphics) return;

    // Check if there's already a component at this position
    const hasComponent = this.hasComponentAtPosition(x, y, this.activePlacementType, this.previewRotation);
    const color = hasComponent ? 0xff0000 : 0x00ff00; // Red if blocked, green if available
    const alpha = hasComponent ? 0.9 : 0.8;
    const fillAlpha = hasComponent ? 0.25 : 0.15;

    // Draw a highlighted grid cell
    this.gridHighlightGraphics.clear();
    this.gridHighlightGraphics.lineStyle(3, color, alpha);
    this.gridHighlightGraphics.fillStyle(color, fillAlpha);
    
    const halfGrid = this.gridSize / 2;
    const rotation = this.previewRotation || 0;
    const angle = rotation % 180;
    
    // Different highlight sizes based on component type
    if (this.activePlacementType === "žica") {
      // Highlight the wire span based on rotation
      if (angle === 0 || angle === 180) {
        // Horizontal wire - highlight 2 cells wide
        this.gridHighlightGraphics.fillRect(
          x - this.gridSize,
          y - halfGrid,
          this.gridSize * 2,
          this.gridSize
        );
        this.gridHighlightGraphics.strokeRect(
          x - this.gridSize,
          y - halfGrid,
          this.gridSize * 2,
          this.gridSize
        );
      } else {
        // Vertical wire - highlight 2 cells tall
        this.gridHighlightGraphics.fillRect(
          x - halfGrid,
          y - this.gridSize,
          this.gridSize,
          this.gridSize * 2
        );
        this.gridHighlightGraphics.strokeRect(
          x - halfGrid,
          y - this.gridSize,
          this.gridSize,
          this.gridSize * 2
        );
      }
    } else {
      // For other components - highlight a single grid cell (component size)
      const componentSize = this.gridSize * 2; // Match typical component display size
      const halfSize = componentSize / 2;
      
      this.gridHighlightGraphics.fillRect(
        x - halfSize,
        y - halfSize,
        componentSize,
        componentSize
      );
      this.gridHighlightGraphics.strokeRect(
        x - halfSize,
        y - halfSize,
        componentSize,
        componentSize
      );
    }
  }

  /**
   * Clear grid highlights
   */
  clearGridHighlights() {
    if (this.gridHighlightGraphics) {
      this.gridHighlightGraphics.clear();
    }
  }

  /**
   * Show connection points of nearby components
   */
  updateConnectionPoints(x, y) {
    this.clearConnectionPoints();
    
    if (!this.connectionPointGraphics) return;

    this.connectionPointGraphics.clear();
    const snapRadius = this.gridSize * 1.5;

    // Find nearby components and highlight their connection points
    for (const component of this.placedComponents) {
      if (component === this.selectedWire) continue;

      const logicComp = component.getData("logicComponent");
      if (!logicComp) continue;

      // Check if component is nearby
      const dx = Math.abs(component.x - x);
      const dy = Math.abs(component.y - y);
      const distance = Math.hypot(dx, dy);

      if (distance < snapRadius) {
        // Highlight start point
        if (logicComp.start) {
          this.connectionPointGraphics.fillStyle(0xff9900, 0.8);
          this.connectionPointGraphics.fillCircle(
            logicComp.start.x,
            logicComp.start.y,
            8
          );
          this.connectionPointGraphics.lineStyle(2, 0xffffff, 1);
          this.connectionPointGraphics.strokeCircle(
            logicComp.start.x,
            logicComp.start.y,
            8
          );
        }

        // Highlight end point
        if (logicComp.end) {
          this.connectionPointGraphics.fillStyle(0xff9900, 0.8);
          this.connectionPointGraphics.fillCircle(
            logicComp.end.x,
            logicComp.end.y,
            8
          );
          this.connectionPointGraphics.lineStyle(2, 0xffffff, 1);
          this.connectionPointGraphics.strokeCircle(
            logicComp.end.x,
            logicComp.end.y,
            8
          );
        }
      }
    }
  }

  /**
   * Clear connection point highlights
   */
  clearConnectionPoints() {
    if (this.connectionPointGraphics) {
      this.connectionPointGraphics.clear();
    }
  }

  /**
   * Check if a component of the specified type exists at the given position
   */
  hasComponentAtPosition(x, y, componentType, rotation = null) {
    // For wires, use the specialized wire check
    if (componentType === "žica") {
      return this.hasWireAtPosition(x, y, rotation);
    }
    
    // For other components, check if any component of the same type overlaps
    const gridSize = this.gridSize || 40;
    const componentSize = gridSize * 2; // Match the display size used in grid highlights
    
    // Map panel type to logic component type
    const typeMapping = {
      'baterija': 'battery',
      'upor': 'resistor',
      'svetilka': 'bulb',
      'stikalo-on': 'switch',
      'stikalo-off': 'switch',
      'ammeter': 'ammeter',
      'voltmeter': 'voltmeter'
    };
    
    const logicType = typeMapping[componentType] || componentType;
    
    for (const component of this.placedComponents) {
      const logicComp = component.getData("logicComponent");
      if (!logicComp) continue;
      
      // Check if this is the same type of component
      const existingLogicType = logicComp.type;
      if (existingLogicType !== logicType) continue;
      
      const dx = Math.abs(component.x - x);
      const dy = Math.abs(component.y - y);
      
      // Check if components overlap (bounding boxes intersect)
      // Two squares of size componentSize overlap if their centers are within componentSize distance
      if (dx < componentSize && dy < componentSize) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a wire exists at the given position
   */
  hasWireAtPosition(x, y, excludeRotation = null) {
    const gridSize = this.gridSize || 40;
    const wireLength = gridSize * 2; // Wire spans 2 grid cells (80 pixels total)
    const wireWidth = gridSize * 0.5; // Wire thickness for collision
    
    for (const component of this.placedComponents) {
      const logicComp = component.getData("logicComponent");
      if (!logicComp || logicComp.type !== "wire") continue;
      
      // Get the existing wire's rotation
      const existingRotation = component.getData("rotation") || 0;
      const existingAngle = existingRotation % 180;
      const existingIsHorizontal = (existingAngle === 0);
      
      // Get the new wire's rotation
      const newRotation = excludeRotation !== null ? excludeRotation : 0;
      const newAngle = newRotation % 180;
      const newIsHorizontal = (newAngle === 0);
      
      const dx = Math.abs(component.x - x);
      const dy = Math.abs(component.y - y);
      
      // Check if wires overlap based on their orientations
      if (existingIsHorizontal && newIsHorizontal) {
        // Both horizontal - check if they overlap
        // Wires overlap if: y positions are close AND x ranges intersect
        if (dy < wireWidth && dx < wireLength) {
          return true;
        }
      } else if (!existingIsHorizontal && !newIsHorizontal) {
        // Both vertical - check if they overlap
        // Wires overlap if: x positions are close AND y ranges intersect
        if (dx < wireWidth && dy < wireLength) {
          return true;
        }
      } else {
        // Different orientations (one horizontal, one vertical)
        // They can cross, but check if they're at the exact same grid position
        if (dx < gridSize * 0.25 && dy < gridSize * 0.25) {
          return true; // Too close to place
        }
      }
    }
    return false;
  }

  /**
   * Show visual feedback when wire is placed
   */
  showPlacementFeedback(x, y) {
    // Create a quick flash effect
    const flash = this.add.circle(x, y, 30, 0x00ff00, 0.6);
    flash.setDepth(200);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        flash.destroy();
      }
    });
  }

  /**
   * Show visual feedback when placement is blocked
   */
  showPlacementBlockedFeedback(x, y) {
    // Create a red X effect
    const flash = this.add.circle(x, y, 30, 0xff0000, 0.7);
    flash.setDepth(200);

    // Add X mark
    const graphics = this.add.graphics();
    graphics.setDepth(201);
    graphics.lineStyle(4, 0xffffff, 1);
    graphics.beginPath();
    graphics.moveTo(x - 15, y - 15);
    graphics.lineTo(x + 15, y + 15);
    graphics.moveTo(x + 15, y - 15);
    graphics.lineTo(x - 15, y + 15);
    graphics.strokePath();

    this.tweens.add({
      targets: [flash, graphics],
      alpha: 0,
      scale: 1.5,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        flash.destroy();
        graphics.destroy();
      }
    });
  }

  /**
   * Delete a component from the workbench
   */
  deleteComponent(component) {
    if (!component || component.getData("isInPanel")) return;

    const x = component.x;
    const y = component.y;

    // Remove from placedComponents array
    const indexToRemove = this.placedComponents.indexOf(component);
    if (indexToRemove > -1) {
      this.placedComponents.splice(indexToRemove, 1);
    }

    // Destroy the component
    component.destroy();

    // Show deletion feedback
    this.showDeletionFeedback(x, y);

    // Rebuild the circuit graph
    this.rebuildGraph();
  }

  /**
   * Show visual feedback when a component is deleted
   */
  showDeletionFeedback(x, y) {
    // Create a puff/disappear effect
    const flash = this.add.circle(x, y, 25, 0xff6666, 0.8);
    flash.setDepth(200);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 300,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        flash.destroy();
      }
    });
  }

  getComponentDetails(type) {
    const details = {
      baterija: "Napetost: 3.3 V\nVir električne energije",
      upor: "Uporabnost: omejuje tok\nMeri se v ohmih (Ω)",
      svetilka: "Pretvarja električno energijo v svetlobo",
      "stikalo-on": "Dovoljuje pretok toka",
      "stikalo-off": "Prepreči pretok toka",
      žica: "Povezuje komponente\nKlikni za obračanje",
      ammeter: "Meri električni tok\nEnota: amperi (A)",
      voltmeter: "Meri električno napetost\nEnota: volti (V)",
      led: "Svetleča dioda (LED)\nSveti samo v eni smeri",
      fuse: "Varovalka\nPregori ob prevelikem toku",
    };
    return details[type] || "Komponenta";
  }

  getMissingComponents() {
    const currentChallenge = this.currentChallenge;
    if (!currentChallenge || !currentChallenge.requiredComponents) {
      return [];
    }
    const placedTypes = this.placedComponents.map((comp) =>
      comp.getData("type")
    );

    const missing = [];
    for (const required of currentChallenge.requiredComponents) {
      const count = currentChallenge.requiredComponents.filter(
        (r) => r === required
      ).length;
      const placed = placedTypes.filter((p) => p === required).length;
      if (placed < count) {
        missing.push(`${required} (${placed}/${count})`);
      }
    }
    return missing;
  }

  updateMissingLabel() {
    const missing = this.getMissingComponents();
    if (missing.length > 0) {
      this.missingText.setText("Manjkajoče: " + missing.join(", "));
      this.missingText.setStyle({ color: "#006effff" });
    } else {
      this.missingText.setText("Vse komponente so na mizi!");
      this.missingText.setStyle({ color: "#00aa00" });
    }
  }

  createGrid() {
    const { width, height } = this.cameras.main;
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(2, 0x8b7355, 0.4);

    const gridSize = 40;
    const startX = 200;

    // vertikalne črte
    for (let x = startX; x < width; x += gridSize) {
      gridGraphics.beginPath();
      gridGraphics.moveTo(x, 0);
      gridGraphics.lineTo(x, height);
      gridGraphics.strokePath();
    }

    // horizontalne črte
    for (let y = 0; y < height; y += gridSize) {
      gridGraphics.beginPath();
      gridGraphics.moveTo(startX, y);
      gridGraphics.lineTo(width, y);
      gridGraphics.strokePath();
    }
  }

  snapToGrid(x, y) {
    const gridSize = this.gridSize;
    const startX = 200;

    // komponeta se postavi na presečišče
    const snappedX = Math.round((x - startX) / gridSize) * gridSize + startX;
    const snappedY = Math.round(y / gridSize) * gridSize;

    return { x: snappedX, y: snappedY };
  }

  /**
   * Rebuild the entire circuit graph from all placed components
   */
  rebuildGraph() {
    this.graph.clear();

    for (const component of this.placedComponents) {
      this.updateLogicNodePositions(component);
      const comp = component.getData("logicComponent");
      if (comp) {
        this.graph.addComponent(comp);
      }
    }

    

    // Auto-simulate and update label after rebuild
    const result = this.graph.simulate();
    console.log('[WorkspaceScene] Simulation result:', result);
    this.circuitCurrent = (result.measurements && result.measurements.current) || 0;
    console.log('[WorkspaceScene] Set circuitCurrent to:', this.circuitCurrent);
    this.updateCircuitStatusLabel(result.status);
    this.updateMissingComponentsLabel();
    this.updateBulbVisuals(result.status);
    this.updateLEDVisuals(result.status);
    this.updateFuseVisuals(result.status);
    this.updateMeasurementLabels();
    this.visualizeElectricity(result.paths);
  }

  /**
   * Update the label showing missing components for current challenge
   */
  updateMissingComponentsLabel() {
    if (
      !this.missingText ||
      !this.currentChallenge
    )
      return;

    const currentChallenge = this.currentChallenge;
    if (!currentChallenge || !currentChallenge.requiredComponents) {
      this.missingText.setText("");
      return;
    }

    // Count placed components by type
    const placedTypes = this.placedComponents.map((comp) =>
      comp.getData("type")
    );

    // Find missing components
    const missing = [];
    const requiredCounts = {};

    // Count required components
    for (const req of currentChallenge.requiredComponents) {
      requiredCounts[req] = (requiredCounts[req] || 0) + 1;
    }

    // Count placed components
    const placedCounts = {};
    for (const type of placedTypes) {
      placedCounts[type] = (placedCounts[type] || 0) + 1;
    }

    // Calculate what's missing
    for (const [type, requiredCount] of Object.entries(requiredCounts)) {
      const placedCount = placedCounts[type] || 0;
      const missingCount = requiredCount - placedCount;
      if (missingCount > 0) {
        missing.push(`${missingCount}x ${type}`);
      }
    }

    // Update label
    if (missing.length > 0) {
      this.missingText.setText(`Manjka: ${missing.join(", ")}`);
      this.missingText.setStyle({ color: "#146c9fff" });
    } else {
      this.missingText.setText("Vse komponente so na mizi ✓");
      this.missingText.setStyle({ color: "#00aa00" });
    }
  }

  /**
   * Update the status label based on simulation result
   */
  updateCircuitStatusLabel(simulationResult) {
    if (!this.checkText) return;

    if (simulationResult === 1) {
      this.checkText.setStyle({ color: "#00aa00" });
      this.checkText.setText("Električni tok je sklenjen");
      this.sim = true;
    } else {
      this.checkText.setStyle({ color: "#cc0000" });
      if (simulationResult === -1) {
        this.checkText.setText("Manjka ti baterija");
      } else if (simulationResult === -2) {
        this.checkText.setText("Stikalo je izklopljeno");
      } else {
        this.checkText.setText("Električni tok ni sklenjen");
      }
      this.sim = false;
    }
  }

  /**
   * Update measurement device labels (ammeter, voltmeter) and component value labels (resistor, battery)
   */
  updateMeasurementLabels() {
    for (const component of this.placedComponents) {
      const logicComp = component.getData("logicComponent");
      if (!logicComp) continue;

      // Update resistor label (show resistance)
      if (logicComp.type === "resistor") {
        let label = component.getData("valueLabel");
        if (!label || !label.active) {
          if (label) {
            component.remove(label, true);
          }
          label = this.add.text(0, -45, "", {
            fontSize: "14px",
            color: "#ffffff",
            backgroundColor: "#ff6600aa",
            padding: { x: 6, y: 3 },
            fontStyle: "bold"
          }).setOrigin(0.5);
          component.add(label);
          label.setPosition(0, -45);
          component.setData("valueLabel", label);
        }
        const resistance = logicComp.ohm || 1.5;
        label.setText(`${resistance.toFixed(1)} Ω`);
        continue;
      }

      // Update battery label (show voltage)
      if (logicComp.type === "battery") {
        let label = component.getData("valueLabel");
        if (!label || !label.active) {
          if (label) {
            component.remove(label, true);
          }
          label = this.add.text(0, -45, "", {
            fontSize: "14px",
            color: "#ffffff",
            backgroundColor: "#ffcc00aa",
            padding: { x: 6, y: 3 },
            fontStyle: "bold"
          }).setOrigin(0.5);
          component.add(label);
          label.setPosition(0, -45);
          component.setData("valueLabel", label);
        }
        const voltage = logicComp.voltage || 3.3;
        label.setText(`${voltage.toFixed(1)} V`);
        continue;
      }

      // Only process measurement devices (ammeter and voltmeter) beyond this point
      if (logicComp.type !== "ammeter" && logicComp.type !== "voltmeter") {
        // Remove any stray valueLabel from non-measurement components
        const strayLabel = component.getData("valueLabel");
        if (strayLabel) {
          component.remove(strayLabel, true);
          component.setData("valueLabel", null);
        }
        continue;
      }

      // Update ammeter label
      if (logicComp.type === "ammeter") {
        let label = component.getData("valueLabel");
        // Check if label exists and is still active (not destroyed)
        if (!label || !label.active) {
          // Remove old label if it exists but is inactive
          if (label) {
            component.remove(label, true);
          }
          label = this.add.text(0, -45, "", {
            fontSize: "14px",
            color: "#ffffff",
            backgroundColor: "#000000aa",
            padding: { x: 6, y: 3 },
            fontStyle: "bold"
          }).setOrigin(0.5);
          component.add(label);
          label.setPosition(0, -45); // Ensure relative position to container
          component.setData("valueLabel", label);
        }
        // Use the ammeter's own current value (set by simulation based on whether it's in path)
        const current = logicComp.isInPath ? (logicComp.current || 0) : 0;
        console.log(`Ammeter ${logicComp.id}: isInPath=${logicComp.isInPath}, current=${current.toFixed(2)} A`);
        label.setText(current > 0 ? `${current.toFixed(2)} A` : "0 A");
      }

      // Update voltmeter label
      if (logicComp.type === "voltmeter") {
        let label = component.getData("valueLabel");
        // Check if label exists and is still active (not destroyed)
        if (!label || !label.active) {
          // Remove old label if it exists but is inactive
          if (label) {
            component.remove(label, true);
          }
          label = this.add.text(0, -45, "", {
            fontSize: "14px",
            color: "#ffffff",
            backgroundColor: "#000000aa",
            padding: { x: 6, y: 3 },
            fontStyle: "bold"
          }).setOrigin(0.5);
          component.add(label);
          label.setPosition(0, -45); // Ensure relative position
          component.setData("valueLabel", label);
        }
        // Use the voltmeter's own voltage value (set by simulation based on connection)
        const voltage = logicComp.isConnected ? (logicComp.voltage || 0) : 0;
        console.log(`Voltmeter ${logicComp.id}: isConnected=${logicComp.isConnected}, voltage=${voltage.toFixed(2)} V`);
        label.setText(voltage > 0 ? `${voltage.toFixed(1)} V` : "0 V");
      }
    }
  }

  /**
   * Update bulb visuals based on circuit state
   */
  updateBulbVisuals(simulationResult) {
    console.log("updateBulbVisuals called with result:", simulationResult);
    for (const component of this.placedComponents) {
      const logicComp = component.getData("logicComponent");
      if (!logicComp || logicComp.type !== "bulb") continue;
      
      // Get the actual image from the container's first child
      const bulbImage = component.getData("componentImage") || component.list[0];
      if (!bulbImage) {
        console.warn("No bulb image found for component:", logicComp.id);
        continue;
      }

      // Check if bulb is burned out
      if (logicComp.isBurnedOut) {
        // Show burned out bulb - dark tint and smoke effect
        bulbImage.setTint(0x333333); // Dark gray tint
        
        // Remove any glow effect
        const glowCircle = component.getData("glowCircle");
        if (glowCircle) {
          glowCircle.setVisible(false);
          this.tweens.killTweensOf(glowCircle);
        }
        
        // Add burned out indicator label if not exists
        let burnedLabel = component.getData("burnedLabel");
        if (!burnedLabel || !burnedLabel.active) {
          if (burnedLabel) {
            component.remove(burnedLabel, true);
          }
          burnedLabel = this.add.text(0, 45, "💥 PREGORELA", {
            fontSize: "11px",
            color: "#cc0000",
            backgroundColor: "#ffffff",
            padding: { x: 4, y: 2 },
            fontStyle: "bold"
          }).setOrigin(0.5);
          component.add(burnedLabel);
          burnedLabel.setPosition(0, 45);
          component.setData("burnedLabel", burnedLabel);
        }
        burnedLabel.setVisible(true);
        
        // Hide wattage label for burned bulbs
        const wattageLabel = component.getData("wattageLabel");
        if (wattageLabel) {
          wattageLabel.setVisible(false);
        }
        
        continue; // Skip normal on/off logic for burned bulbs
      }

      // Hide burned label if bulb is not burned
      const burnedLabel = component.getData("burnedLabel");
      if (burnedLabel) {
        burnedLabel.setVisible(false);
      }

      const isOn = logicComp.is_on && simulationResult === 1;
      console.log(`Bulb ${logicComp.id}: is_on=${logicComp.is_on}, simulationResult=${simulationResult}, isOn=${isOn}`);
      
      // Update wattage label
      let wattageLabel = component.getData("wattageLabel");
      if (!wattageLabel || !wattageLabel.active) {
        if (wattageLabel) {
          component.remove(wattageLabel, true);
        }
        wattageLabel = this.add.text(0, -45, "", {
          fontSize: "12px",
          color: "#ffffff",
          backgroundColor: "#4488ffaa",
          padding: { x: 4, y: 2 },
          fontStyle: "bold"
        }).setOrigin(0.5);
        component.add(wattageLabel);
        wattageLabel.setPosition(0, -45);
        component.setData("wattageLabel", wattageLabel);
      }
      
      if (isOn && logicComp.currentWattage > 0) {
        const wattagePercent = (logicComp.currentWattage / logicComp.maxWattage) * 100;
        const color = wattagePercent > 80 ? "#ff4444" : (wattagePercent > 50 ? "#ffaa00" : "#44ff44");
        wattageLabel.setText(`${logicComp.currentWattage.toFixed(2)}W / ${logicComp.maxWattage}W`);
        wattageLabel.setBackgroundColor(wattagePercent > 80 ? "#cc0000aa" : "#4488ffaa");
        wattageLabel.setVisible(true);
      } else {
        wattageLabel.setText(`Max: ${logicComp.maxWattage}W`);
        wattageLabel.setBackgroundColor("#666666aa");
        wattageLabel.setVisible(true);
      }
      
      if (isOn) {
        // Calculate brightness based on power (wattage percentage)
        const wattagePercent = Math.min((logicComp.currentWattage / logicComp.maxWattage) * 100, 100);
        // Ensure minimum brightness of 50% so low power is still visible
        const brightness = Math.max(0.5, wattagePercent / 100);
        
        // Calculate tint color based on power - from warm orange to bright yellow/white
        // Low power: warm orange (0xffbb66), High power: bright yellow-white (0xffffdd)
        const r = 255;
        const g = Math.floor(187 + (brightness * 68)); // 187-255
        const b = Math.floor(102 + (brightness * 119)); // 102-221
        const tintColor = (r << 16) | (g << 8) | b;
        
        bulbImage.setTint(tintColor);
        
        // Add a glowing circle around the bulb with intensity based on power
        if (!component.getData("glowCircle")) {
          const glowCircle = this.add.circle(0, 0, 38, 0xffee44, 0.5);
          glowCircle.setBlendMode(Phaser.BlendModes.ADD);
          component.add(glowCircle);
          component.sendToBack(glowCircle); // Behind the bulb image
          component.setData("glowCircle", glowCircle);
        }
        const glowCircle = component.getData("glowCircle");
        if (glowCircle) {
          glowCircle.setVisible(true);
          
          // Set glow color based on power - orange for low, yellow for medium, white-ish for high
          let glowColor;
          if (wattagePercent > 80) {
            glowColor = 0xffffaa; // Bright yellowish-white (high power, near burnout)
          } else if (wattagePercent > 50) {
            glowColor = 0xffee44; // Bright yellow
          } else if (wattagePercent > 25) {
            glowColor = 0xffcc22; // Orange-yellow
          } else {
            glowColor = 0xffbb44; // Warm orange (more visible than before)
          }
          
          // Alpha based on brightness but with higher minimum
          const glowAlpha = 0.4 + (brightness * 0.4); // 0.6 to 0.8
          glowCircle.setFillStyle(glowColor, glowAlpha);
          
          // Scale glow size based on brightness - smaller at low power
          const glowScale = 0.5 + (brightness * 0.7); // 0.5 to 1.2
          
          // Kill existing tweens before adding new ones
          this.tweens.killTweensOf(glowCircle);
          
          // Set base scale
          glowCircle.setScale(glowScale);
          
          // Pulsing glow effect - more intense at higher power
          const pulseIntensity = 0.05 + (brightness * 0.2); // 0.1 to 0.25
          this.tweens.add({
            targets: glowCircle,
            alpha: { from: glowAlpha * 0.7, to: glowAlpha },
            scale: { from: glowScale, to: glowScale + pulseIntensity },
            duration: 1400 - (brightness * 400), // Faster pulse at higher power
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        }
      } else {
        // Remove glow effect when bulb is off
        bulbImage.clearTint();
        
        const glowCircle = component.getData("glowCircle");
        if (glowCircle) {
          glowCircle.setVisible(false);
          this.tweens.killTweensOf(glowCircle);
        }
      }
    }
  }

  /**
   * Update LED visuals based on circuit state
   */
  updateLEDVisuals(simulationResult) {
    for (const component of this.placedComponents) {
      const logicComp = component.getData("logicComponent");
      if (!logicComp || logicComp.type !== "led") continue;
      
      const ledImage = component.getData("componentImage") || component.list[0];
      if (!ledImage) continue;

      // Check if LED is burned out
      if (logicComp.isBurnedOut) {
        ledImage.setTint(0x333333); // Dark gray tint
        
        // Remove glow
        const glowCircle = component.getData("glowCircle");
        if (glowCircle) {
          glowCircle.setVisible(false);
          this.tweens.killTweensOf(glowCircle);
        }
        
        // Add burned out label
        let burnedLabel = component.getData("burnedLabel");
        if (!burnedLabel || !burnedLabel.active) {
          if (burnedLabel) component.remove(burnedLabel, true);
          burnedLabel = this.add.text(0, 45, "💥 PREGORELA", {
            fontSize: "10px",
            color: "#cc0000",
            backgroundColor: "#ffffff",
            padding: { x: 3, y: 1 },
            fontStyle: "bold"
          }).setOrigin(0.5);
          component.add(burnedLabel);
          component.setData("burnedLabel", burnedLabel);
        }
        burnedLabel.setVisible(true);
        continue;
      }

      // Hide burned label if not burned
      const burnedLabel = component.getData("burnedLabel");
      if (burnedLabel) burnedLabel.setVisible(false);

      // Check if LED is reverse biased
      if (logicComp.isReverseBiased) {
        ledImage.setTint(0x555555); // Darker gray for reverse biased
        
        // Hide glow
        const glowCircle = component.getData("glowCircle");
        if (glowCircle) {
          glowCircle.setVisible(false);
          this.tweens.killTweensOf(glowCircle);
        }
        
        // Show reverse bias label
        let reverseLabel = component.getData("reverseLabel");
        if (!reverseLabel || !reverseLabel.active) {
          if (reverseLabel) component.remove(reverseLabel, true);
          reverseLabel = this.add.text(0, 45, "⚠️ OBRNJENA", {
            fontSize: "10px",
            color: "#ff9900",
            backgroundColor: "#ffffff",
            padding: { x: 3, y: 1 },
            fontStyle: "bold"
          }).setOrigin(0.5);
          component.add(reverseLabel);
          component.setData("reverseLabel", reverseLabel);
        }
        reverseLabel.setVisible(true);
        continue;
      }
      
      // Hide reverse label if not reverse biased
      const reverseLabel = component.getData("reverseLabel");
      if (reverseLabel) reverseLabel.setVisible(false);

      const isOn = logicComp.is_on && simulationResult === 1;
      
      if (isOn) {
        // Apply LED color tint
        const ledColorHex = logicComp.getColorHex();
        ledImage.setTint(ledColorHex);
        
        // Add glow effect
        if (!component.getData("glowCircle")) {
          const glowCircle = this.add.circle(0, 0, 30, ledColorHex, 0.6);
          glowCircle.setBlendMode(Phaser.BlendModes.ADD);
          component.add(glowCircle);
          component.sendToBack(glowCircle);
          component.setData("glowCircle", glowCircle);
        }
        const glowCircle = component.getData("glowCircle");
        if (glowCircle) {
          glowCircle.setFillStyle(logicComp.getGlowHex(), 0.6);
          glowCircle.setVisible(true);
          
          this.tweens.killTweensOf(glowCircle);
          this.tweens.add({
            targets: glowCircle,
            alpha: { from: 0.4, to: 0.7 },
            scale: { from: 0.8, to: 1.0 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        }
      } else {
        // LED off - show base color slightly
        ledImage.setTint(0x666666);
        
        const glowCircle = component.getData("glowCircle");
        if (glowCircle) {
          glowCircle.setVisible(false);
          this.tweens.killTweensOf(glowCircle);
        }
      }
    }
  }

  /**
   * Update Fuse visuals based on circuit state
   */
  updateFuseVisuals(simulationResult) {
    for (const component of this.placedComponents) {
      const logicComp = component.getData("logicComponent");
      if (!logicComp || logicComp.type !== "fuse") continue;
      
      const fuseImage = component.getData("componentImage") || component.list[0];
      if (!fuseImage) continue;

      // Check if fuse is blown
      if (logicComp.isBlown) {
        fuseImage.setTint(0x444444); // Dark tint for blown fuse
        
        // Add blown label
        let blownLabel = component.getData("blownLabel");
        if (!blownLabel || !blownLabel.active) {
          if (blownLabel) component.remove(blownLabel, true);
          blownLabel = this.add.text(0, 45, "⚡ PREGORELA", {
            fontSize: "10px",
            color: "#ff6600",
            backgroundColor: "#ffffff",
            padding: { x: 3, y: 1 },
            fontStyle: "bold"
          }).setOrigin(0.5);
          component.add(blownLabel);
          component.setData("blownLabel", blownLabel);
        }
        blownLabel.setVisible(true);
        
        // Show current rating
        let ratingLabel = component.getData("ratingLabel");
        if (ratingLabel) ratingLabel.setVisible(false);
      } else {
        // Hide blown label
        const blownLabel = component.getData("blownLabel");
        if (blownLabel) blownLabel.setVisible(false);
        
        // Show rating label
        let ratingLabel = component.getData("ratingLabel");
        if (!ratingLabel || !ratingLabel.active) {
          if (ratingLabel) component.remove(ratingLabel, true);
          ratingLabel = this.add.text(0, -45, "", {
            fontSize: "11px",
            color: "#ffffff",
            backgroundColor: "#666666aa",
            padding: { x: 4, y: 2 },
            fontStyle: "bold"
          }).setOrigin(0.5);
          component.add(ratingLabel);
          component.setData("ratingLabel", ratingLabel);
        }
        ratingLabel.setText(`${logicComp.maxCurrent.toFixed(1)} A`);
        ratingLabel.setVisible(true);
        
        // Normal fuse appearance
        fuseImage.clearTint();
      }
    }
  }

  /**
   * Visualize electricity flow along circuit paths
   */
  visualizeElectricity(paths) {
    // Clear existing particles
    this.electricityParticles.forEach((p) => {
      if (p.tween) p.tween.remove();
      p.destroy();
    });
    this.electricityParticles = [];
    this.electricityGraphics.clear();

    if (!paths || paths.length === 0) {
      // No paths - circuit is open, no particles
      return;
    }

    

    // Create particles for ALL paths, not just the first one
    const PARTICLE_COUNT_PER_PATH = 4;
    const PARTICLE_SPEED = 4000; // ms per complete cycle

    for (let pathIndex = 0; pathIndex < paths.length; pathIndex++) {
      const path = paths[pathIndex];
      if (!path || path.length === 0) continue;

      for (let i = 0; i < PARTICLE_COUNT_PER_PATH; i++) {
        const delay = i * (PARTICLE_SPEED / PARTICLE_COUNT_PER_PATH);

        this.time.delayedCall(delay, () => {
          this.createElectricityParticle(path);
        });
      }
    }
  }

  /**
   * Create a single electricity particle that flows through the path
   */
  createElectricityParticle(path) {
    // Create a simple small particle
    const particle = this.add.circle(0, 0, 6, 0xffdd00, 0.95);
    particle.setDepth(10);

    const waypoints = [];
    const CONNECTION_THRESHOLD = 35;

    // Helper to check if two points are connected
    const areClose = (p1, p2) => {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      return Math.hypot(dx, dy) <= CONNECTION_THRESHOLD;
    };

    // Build connected waypoints - ensure each component connects to the previous one
    if (path.length > 0) {
      const first = path[0];
      waypoints.push({ x: first.start.x, y: first.start.y });
      waypoints.push({ x: first.end.x, y: first.end.y });

      for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const curr = path[i];
        const lastPoint = waypoints[waypoints.length - 1];

        // Determine which end of current component connects to the previous
        if (areClose(lastPoint, curr.start)) {
          // Previous connects to current's start -> add start then end
          waypoints.push({ x: curr.start.x, y: curr.start.y });
          waypoints.push({ x: curr.end.x, y: curr.end.y });
        } else if (areClose(lastPoint, curr.end)) {
          // Previous connects to current's end -> add end then start (reversed)
          waypoints.push({ x: curr.end.x, y: curr.end.y });
          waypoints.push({ x: curr.start.x, y: curr.start.y });
        } else {
          // Not directly connected - just add in order
          waypoints.push({ x: curr.start.x, y: curr.start.y });
          waypoints.push({ x: curr.end.x, y: curr.end.y });
        }
      }

      // Add battery terminals to close the loop
      const battery = this.placedComponents.find(
        (container) => container.getData("logicComponent")?.type === "battery"
      );
      if (battery) {
        const batteryComp = battery.getData("logicComponent");
        const lastPoint = waypoints[waypoints.length - 1];

        // Connect back through battery to complete the circuit
        if (areClose(lastPoint, batteryComp.end)) {
          waypoints.push({ x: batteryComp.end.x, y: batteryComp.end.y });
          waypoints.push({ x: batteryComp.start.x, y: batteryComp.start.y });
        } else if (areClose(lastPoint, batteryComp.start)) {
          waypoints.push({ x: batteryComp.start.x, y: batteryComp.start.y });
          waypoints.push({ x: batteryComp.end.x, y: batteryComp.end.y });
        }
      }
    }

    if (waypoints.length === 0) {
      particle.destroy();
      return;
    }

    let currentWaypoint = 0;
    particle.setPosition(waypoints[0].x, waypoints[0].y);

    const moveToNext = () => {
      currentWaypoint++;
      if (currentWaypoint >= waypoints.length) {
        // Loop back to start
        currentWaypoint = 0;
      }

      const target = waypoints[currentWaypoint];
      const distance = Phaser.Math.Distance.Between(
        particle.x,
        particle.y,
        target.x,
        target.y
      );
      const duration = Math.max(200, distance * 2); // proportional to distance

      const tween = this.tweens.add({
        targets: particle,
        x: target.x,
        y: target.y,
        duration: duration,
        ease: "Sine.easeInOut",
        onComplete: moveToNext,
      });

      particle.tween = tween;
    };

    moveToNext();
    this.electricityParticles.push(particle);
  }

  getRandomInt(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
  }

  updateLogicNodePositions(component) {
    const comp = component.getData("logicComponent");
    if (!comp) return;

    // derive local offsets: prefer comp-local offsets, else use half display
    const halfW = 40;
    const halfH = 40;

    const localStart = comp.localStart || { x: -halfW, y: 0 };
    const localEnd = comp.localEnd || { x: halfW, y: 0 };

    // get container angle in radians (Phaser keeps both .angle and .rotation)
    const theta =
      typeof component.rotation === "number" && component.rotation
        ? component.rotation
        : Phaser.Math.DegToRad(component.angle || 0);

    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const rotate = (p) => ({
      x: Math.round(p.x * cos - p.y * sin),
      y: Math.round(p.x * sin + p.y * cos),
    });

    const rStart = rotate(localStart);
    const rEnd = rotate(localEnd);

    const worldStart = { x: component.x + rStart.x, y: component.y + rStart.y };
    const worldEnd = { x: component.x + rEnd.x, y: component.y + rEnd.y };

    const snappedStart = this.snapToGrid(worldStart.x, worldStart.y);
    const snappedEnd = this.snapToGrid(worldEnd.x, worldEnd.y);

    // Update node positions (don't add to graph here - rebuildGraph does that)
    if (comp.start) {
      comp.start.x = snappedStart.x;
      comp.start.y = snappedStart.y;
    }
    if (comp.end) {
      comp.end.x = snappedEnd.x;
      comp.end.y = snappedEnd.y;
    }

    // debug dots are top-level objects (not children). update their positions
    const startDot = component.getData("startDot");
    const endDot = component.getData("endDot");
    if (startDot && comp.start) {
      startDot.x = comp.start.x;
      startDot.y = comp.start.y;
    }
    if (endDot && comp.end) {
      endDot.x = comp.end.x;
      endDot.y = comp.end.y;
    }
  }

  detectComponentOverlap(draggedComponent, snappedPos) {
    const threshold = 50; // overlap threshold in pixels

    for (let placed of this.placedComponents) {
      if (placed === draggedComponent) continue;

      const dx = Math.abs(snappedPos.x - placed.x);
      const dy = Math.abs(snappedPos.y - placed.y);
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < threshold) {
        return placed;
      }
    }
    return null;
  }

  swapComponents(draggedComponent, targetComponent, dragStartPos) {
    // swap display positions: dragged goes to target's position, target goes to drag start position
    const targetX = targetComponent.x;
    const targetY = targetComponent.y;
    const targetRotation = targetComponent.getData("rotation");
    const targetAngle = targetComponent.angle;

    targetComponent.x = dragStartPos.x;
    targetComponent.y = dragStartPos.y;
    targetComponent.setData("rotation", draggedComponent.getData("rotation"));
    targetComponent.angle = draggedComponent.angle;

    draggedComponent.x = targetX;
    draggedComponent.y = targetY;
    draggedComponent.setData("rotation", targetRotation);
    draggedComponent.angle = targetAngle;

    // Rebuild graph after swap
    this.rebuildGraph();
  }

  createComponent(x, y, type, color, options = {}) {
    const { isInPanel = true } = options;
    const component = this.add.container(x, y);

    let comp = null;
    let componentImage;
    let id;

    switch (type) {
      case "baterija":
        id = "bat_" + this.getRandomInt(1000, 9999);
        comp = new Battery(
          id,
          new Node(id + "_start", -40, 0),
          new Node(id + "_end", 40, 0),
          3.3
        );
        comp.type = "battery";
        comp.localStart = { x: -40, y: 0 };
        comp.localEnd = { x: 40, y: 0 };
        componentImage = this.add
          .image(0, 0, "baterija")
          .setOrigin(0.5)
          .setDisplaySize(100, 100);
        component.add(componentImage);
        component.setData("logicComponent", comp);
        break;

      case "upor":
        id = "res_" + this.getRandomInt(1000, 9999);
        comp = new Resistor(
          id,
          new Node(id + "_start", -40, 0),
          new Node(id + "_end", 40, 0),
          1.5
        );
        comp.type = "resistor";
        comp.localStart = { x: -40, y: 0 };
        comp.localEnd = { x: 40, y: 0 };
        componentImage = this.add
          .image(0, 0, "upor")
          .setOrigin(0.5)
          .setDisplaySize(100, 100);
        component.add(componentImage);
        component.setData("logicComponent", comp);
        break;

      case "svetilka":
        id = "bulb_" + this.getRandomInt(1000, 9999);
        comp = new Bulb(
          id,
          new Node(id + "_start", -40, 0),
          new Node(id + "_end", 40, 0)
        );
        comp.type = "bulb";
        comp.localStart = { x: -40, y: 0 };
        comp.localEnd = { x: 40, y: 0 };
        componentImage = this.add
          .image(0, 0, "svetilka")
          .setOrigin(0.5)
          .setDisplaySize(100, 100);
        component.add(componentImage);
        component.setData("logicComponent", comp);
        // Store reference to the actual image for glow effect
        component.setData("componentImage", componentImage);
        break;

      case "stikalo-on":
        id = "switch_" + this.getRandomInt(1000, 9999);
        comp = new Switch(
          id,
          new Node(id + "_start", -40, 0),
          new Node(id + "_end", 40, 0),
          true
        );
        comp.type = "switch";
        comp.localStart = { x: -40, y: 0 };
        comp.localEnd = { x: 40, y: 0 };
        componentImage = this.add
          .image(0, 0, "stikalo-on")
          .setOrigin(0.5)
          .setDisplaySize(100, 100);
        component.add(componentImage);
        component.setData("logicComponent", comp);
        break;

      case "stikalo-off":
        id = "switch_" + this.getRandomInt(1000, 9999);
        comp = new Switch(
          id,
          new Node(id + "_start", -40, 0),
          new Node(id + "_end", 40, 0),
          false
        );
        comp.type = "switch";
        comp.localStart = { x: -40, y: 0 };
        comp.localEnd = { x: 40, y: 0 };
        componentImage = this.add
          .image(0, 0, "stikalo-off")
          .setOrigin(0.5)
          .setDisplaySize(100, 100);
        component.add(componentImage);
        component.setData("logicComponent", comp);
        break;

      case "žica":
        id = "wire_" + this.getRandomInt(1000, 9999);
        comp = new Wire(
          id,
          new Node(id + "_start", -40, 0),
          new Node(id + "_end", 40, 0)
        );
        comp.type = "wire";
        comp.localStart = { x: -40, y: 0 };
        comp.localEnd = { x: 40, y: 0 };
        componentImage = this.add
          .image(0, 0, "žica")
          .setOrigin(0.5)
          .setDisplaySize(100, 100);
        // Don't apply tint by default - keep original wire image
        component.add(componentImage);
        component.setData("logicComponent", comp);
        component.setData("componentImage", componentImage);
        break;
     case "ammeter":
  id = "ammeter_" + this.getRandomInt(1000, 9999);
  comp = new Wire(  // Or create an Ammeter class if you need special behavior
    id,
    new Node(id + "_start", -40, 0),
    new Node(id + "_end", 40, 0)
  );
  comp.type = "ammeter";
  comp.localStart = { x: -40, y: 0 };
  comp.localEnd = { x: 40, y: 0 };
  componentImage = this.add
    .image(0, 0, "ammeter")
    .setOrigin(0.5)
    .setDisplaySize(100, 100);
  component.add(componentImage);
  component.setData("logicComponent", comp);
  break;

case "voltmeter":
  id = "voltmeter_" + this.getRandomInt(1000, 9999);
  comp = new Wire(  // Or create a Voltmeter class
    id,
    new Node(id + "_start", -40, 0),
    new Node(id + "_end", 40, 0)
  );
  comp.type = "voltmeter";
  comp.localStart = { x: -40, y: 0 };
  comp.localEnd = { x: 40, y: 0 };
  componentImage = this.add
    .image(0, 0, "voltmeter")
    .setOrigin(0.5)
    .setDisplaySize(100, 100);
  component.add(componentImage);
  component.setData("logicComponent", comp);
  break;

case "led":
  id = "led_" + this.getRandomInt(1000, 9999);
  comp = new LED(
    id,
    new Node(id + "_start", -40, 0),
    new Node(id + "_end", 40, 0)
  );
  comp.type = "led";
  comp.localStart = { x: -40, y: 0 };
  comp.localEnd = { x: 40, y: 0 };
  componentImage = this.add
    .image(0, 0, "led")
    .setOrigin(0.5)
    .setDisplaySize(100, 100);
  component.add(componentImage);
  component.setData("logicComponent", comp);
  component.setData("componentImage", componentImage);
  break;

case "fuse":
  id = "fuse_" + this.getRandomInt(1000, 9999);
  comp = new Fuse(
    id,
    new Node(id + "_start", -40, 0),
    new Node(id + "_end", 40, 0)
  );
  comp.type = "fuse";
  comp.localStart = { x: -40, y: 0 };
  comp.localEnd = { x: 40, y: 0 };
  componentImage = this.add
    .image(0, 0, "fuse")
    .setOrigin(0.5)
    .setDisplaySize(100, 100);
  component.add(componentImage);
  component.setData("logicComponent", comp);
  component.setData("componentImage", componentImage);
  break;
    }

    component.on("pointerover", (pointer) => {
      if (component.getData("isInPanel")) {
        // prikaži info okno
        const details = this.getComponentDetails(type);
        this.infoText.setText(details);

        // Position to the right of the panel (panelWidth + offset)
        this.infoWindow.x = this.panelWidth + 110;
        this.infoWindow.y = pointer.y;
        this.infoWindow.setVisible(true);
        
        // Store which component is being hovered
        this.hoveredPanelComponent = component;
      }
      component.setScale(1.1);
    });

    component.on("pointermove", (pointer) => {
      if (component.getData("isInPanel") && this.infoWindow.visible) {
        // Follow mouse Y position, but keep X fixed to the right of panel
        this.infoWindow.x = this.panelWidth + 110;
        this.infoWindow.y = pointer.y;
      }
    });

    component.on("pointerout", () => {
      if (component.getData("isInPanel")) {
        this.infoWindow.setVisible(false);
        this.hoveredPanelComponent = null;
      }
      component.setScale(1);
    });

    // Label - only show for panel components
    if (isInPanel) {
      // Friendly name mapping for panel labels
      const labelNames = {
        "baterija": "baterija",
        "upor": "upor",
        "svetilka": "svetilka",
        "stikalo-off": "stikalo",
        "stikalo-on": "stikalo",
        "žica": "žica",
        "ammeter": "ammeter",
        "voltmeter": "voltmeter",
        "led": "LED",
        "fuse": "varovalka"
      };
      const labelText = labelNames[type] || type;
      const label = this.add
        .text(0, 30, labelText, {
          fontSize: "11px",
          color: "#fff",
          backgroundColor: "#00000088",
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5);
      component.add(label);
    }

    component.setSize(70, 70);
    component.setInteractive({ draggable: true, useHandCursor: true });

    // shrani originalno pozicijo in tip
    component.setData("originalX", x);
    component.setData("originalY", y);
    component.setData("type", type);
    component.setData("color", color);
    component.setData("isInPanel", isInPanel);
    component.setData("rotation", 0);
    if (comp) component.setData("logicComponent", comp);
    if (componentImage) component.setData("componentImage", componentImage);
    component.setData("isDragging", false);

    // Panel components should stay fixed on screen when camera moves
    if (isInPanel) {
      component.setScrollFactor(0);
      component.setDepth(801);
    }

    this.input.setDraggable(component);

    component.on("dragstart", () => {
      this.currentlyDraggedComponent = component;
      component.setData("isDragging", true);
      component.setData("dragStartX", component.x);
      component.setData("dragStartY", component.y);
      component.setData("hasSwapped", false);
      
      // Exit placement mode when dragging any component
      if (this.activePlacementType) {
        this.deactivatePlacementMode();
      }
    });

    component.on("drag", (pointer, dragX, dragY) => {
      // For panel components (scrollFactor 0), use screen coordinates during drag
      // For workbench components, use the provided drag coordinates
      if (component.getData("isInPanel")) {
        component.x = pointer.x;
        component.y = pointer.y;
      } else {
        component.x = dragX;
        component.y = dragY;
      }
    });

    component.on("dragend", () => {
      this.currentlyDraggedComponent = null;
      const wasInPanel = component.getData("isInPanel");
      
      // For panel components, check screen X position; for workbench components, check world position
      const screenX = wasInPanel ? component.x : component.x - this.cameras.main.scrollX;
      const isInPanel = screenX < 200;
      
      const dragStartX = component.getData("dragStartX");
      const dragStartY = component.getData("dragStartY");

      if (isInPanel && !wasInPanel) {
        // če je ob strani, se odstrani
        const indexToRemove = this.placedComponents.indexOf(component);
        if (indexToRemove > -1) {
          this.placedComponents.splice(indexToRemove, 1);
        }
        component.destroy();
        this.rebuildGraph();
      } else if (!isInPanel && wasInPanel) {
        // s strani na mizo - convert screen coordinates to world coordinates
        const worldX = component.x + this.cameras.main.scrollX;
        const worldY = component.y + this.cameras.main.scrollY;
        const snapped = this.snapToGrid(worldX, worldY);
        component.x = snapped.x;
        component.y = snapped.y;

        // Check if dragging from panel onto an existing component on bench
        const overlappingComponent = this.detectComponentOverlap(
          component,
          snapped
        );
        if (overlappingComponent) {
          // Delete the component on bench
          const indexToRemove =
            this.placedComponents.indexOf(overlappingComponent);
          if (indexToRemove > -1) {
            this.placedComponents.splice(indexToRemove, 1);
          }
          overlappingComponent.destroy();
        }

        component.setData("isRotated", false);
        component.setData("isInPanel", false);
        // Remove scroll factor when moving to workbench so it moves with camera
        component.setScrollFactor(1);
        component.setDepth(0);
        
        // Remove the label when placing on workbench
        const label = component.list.find(child => child.type === 'Text' && child.text === component.getData("type"));
        if (label) {
          component.remove(label, true);
        }
        
        this.placedComponents.push(component);

        this.createComponent(
          component.getData("originalX"),
          component.getData("originalY"),
          component.getData("type"),
          component.getData("color")
        );

        this.rebuildGraph();
      } else if (!wasInPanel) {
        // on the workbench - check for overlap and swap if detected
        const snapped = this.snapToGrid(component.x, component.y);
        const overlappingComponent = this.detectComponentOverlap(
          component,
          snapped
        );

        if (overlappingComponent) {
          // swap with drag start position recorded
          this.swapComponents(component, overlappingComponent, {
            x: dragStartX,
            y: dragStartY,
          });
        } else {
          // no overlap, just snap to grid
          component.x = snapped.x;
          component.y = snapped.y;
        }
        this.rebuildGraph();
      } else {
        // postavi se nazaj na originalno mesto
        component.x = component.getData("originalX");
        component.y = component.getData("originalY");
        this.rebuildGraph();
      }

      this.time.delayedCall(500, () => {
        component.setData("isDragging", false);
      });
    });

    // Toggle switches on click
    component.on("pointerup", (pointer) => {
      if (component.getData("isInPanel")) {
        this.handlePanelComponentPointerUp(component, pointer);
        return;
      }

      // Determine click duration and movement to distinguish short click
      const clickDuration =
        (pointer.upTime || this.time.now) - (pointer.downTime || 0);
      const dx = (pointer.downX || 0) - (pointer.x || 0);
      const dy = (pointer.downY || 0) - (pointer.y || 0);
      const moved = Math.sqrt(dx * dx + dy * dy);

      const CLICK_MS_THRESHOLD = 300; // ms
      const MOVE_PX_THRESHOLD = 10; // px

      if (clickDuration <= CLICK_MS_THRESHOLD && moved <= MOVE_PX_THRESHOLD) {
        const logicComp = component.getData("logicComponent");

        // Handle switch toggle on click
        if (logicComp && logicComp.type === "switch") {
          logicComp.is_on = !logicComp.is_on;

          // Update visual
          const componentImage = component.list[0];
          if (componentImage) {
            componentImage.setTexture(
              logicComp.is_on ? "stikalo-on" : "stikalo-off"
            );
          }

          this.rebuildGraph();
        }

        // Handle battery voltage adjustment on click (with cooldown)
        if (logicComp && logicComp.type === "battery" && !this.dialogCooldown) {
          this.dialogCooldown = true;
          this.showVoltageDialog(logicComp, component);
          this.time.delayedCall(500, () => { this.dialogCooldown = false; });
        }

        // Handle resistor resistance adjustment on click (with cooldown)
        if (logicComp && logicComp.type === "resistor" && !this.dialogCooldown) {
          this.dialogCooldown = true;
          this.showResistanceDialog(logicComp, component);
          this.time.delayedCall(500, () => { this.dialogCooldown = false; });
        }

        // Handle bulb wattage adjustment or replacement on click (with cooldown)
        if (logicComp && logicComp.type === "bulb" && !this.dialogCooldown) {
          this.dialogCooldown = true;
          this.showBulbDialog(logicComp, component);
          this.time.delayedCall(500, () => { this.dialogCooldown = false; });
        }

        // Handle wire color selection on click (with cooldown)
        if (logicComp && logicComp.type === "wire" && !this.dialogCooldown) {
          this.dialogCooldown = true;
          this.showWireColorDialog(logicComp, component);
          this.time.delayedCall(500, () => { this.dialogCooldown = false; });
        }

        // Handle LED color selection or replacement on click (with cooldown)
        if (logicComp && logicComp.type === "led" && !this.dialogCooldown) {
          this.dialogCooldown = true;
          this.showLEDDialog(logicComp, component);
          this.time.delayedCall(500, () => { this.dialogCooldown = false; });
        }

        // Handle Fuse rating adjustment or replacement on click (with cooldown)
        if (logicComp && logicComp.type === "fuse" && !this.dialogCooldown) {
          this.dialogCooldown = true;
          this.showFuseDialog(logicComp, component);
          this.time.delayedCall(500, () => { this.dialogCooldown = false; });
        }
      }
    });

    // Right-click to delete component from workbench
    component.on("pointerdown", (pointer) => {
      if (pointer.rightButtonDown() && !component.getData("isInPanel")) {
        this.deleteComponent(component);
      }
    });

    // hover efekt
    component.on("pointerover", () => {
      component.setScale(1.1);
    });

    component.on("pointerout", () => {
      component.setScale(1);
    });

    return component;
  }

  async checkCircuit() {
    // In sandbox mode, just run simulation and show result
    if (this.isSandboxMode) {
      this.rebuildGraph();
      if (this.sim) {
        this.checkText.setStyle({ color: "#00aa00" });
        this.checkText.setText("Električni krog je sklenjen! ✓");
      } else {
        this.checkText.setStyle({ color: "#cc0000" });
        this.checkText.setText("Električni krog ni sklenjen.");
      }
      return;
    }
    
    // Challenge mode logic
    const currentChallenge = this.currentChallenge;
    if (!currentChallenge || !currentChallenge.requiredComponents) {
      this.checkText.setText("Naloga ni naložena.");
      return;
    }
    const placedTypes = this.placedComponents.map((comp) =>
      comp.getData("type")
    );
    this.checkText.setStyle({ color: "#cc0000" });
    // preverjas ce so vse komponente na mizi
    if (
      !currentChallenge.requiredComponents.every((req) =>
        placedTypes.includes(req)
      )
    ) {
      this.checkText.setText("Manjkajo komponente za krog.");
      return;
    }

    // je pravilna simulacija
    if (this.sim == undefined) {
      this.checkText.setText("Zaženi simlacijo");
      return;
    }

    if (this.sim == false) {
      this.checkText.setText(
        "Električni krog ni sklenjen. Preveri kako si ga sestavil"
      );
      return;
    }

    // je zaprt krog

    this.checkText.setStyle({ color: "#00aa00" });
    this.checkText.setText("Čestitke! Krog je pravilen.");
    
    // Ask backend to award the challenge's points (do not send a hardcoded score)
    const serverConfirmed = await this.addPoints();

    if (currentChallenge.theory) {
      this.showTheory(currentChallenge.theory);
    } else {
      this.checkText.setStyle({ color: "#00aa00" });
      this.checkText.setText("Čestitke! Krog je pravilen.");
      this.time.delayedCall(1000, () => {
        this.nextChallenge(!!serverConfirmed);
      });
    }
    // this.placedComponents.forEach(comp => comp.destroy());
    // this.placedComponents = [];
    // this.time.delayedCall(2000, () => this.nextChallenge());
    // const isCorrect = currentChallenge.requiredComponents.every(req => placedTypes.includes(req));
    // if (isCorrect) {
    //   this.checkText.setText('Čestitke! Krog je pravilen.');
    //   this.addPoints(10);
    //   this.time.delayedCall(2000, () => this.nextChallenge());
    // }
    // else {
    //   this.checkText.setText('Krog ni pravilen. Poskusi znova.');
    // }
  }

  nextChallenge(skipIncrement = false) {
    if (!skipIncrement && !this.serverAdvanced) {
      this.currentChallengeIndex++;
    } else if (this.serverAdvanced) {
      this.serverAdvanced = false;
    }

    localStorage.setItem(
      "currentChallengeIndex",
     
      this.currentChallengeIndex.toString()
    );
    this.checkText.setText("");

    // Fetch the next challenge from the API
    this.fetchCurrentChallenge();
  }

  async addPoints(points) {
    const username = localStorage.getItem("username");
    const token = localStorage.getItem("token");

    // Offline fallback: use local challenge points if available, else 10
    if (!token) {
      const offlinePoints = this.currentChallenge?.points ?? 10;
      const users = JSON.parse(localStorage.getItem("users")) || [];
      const userData = users.find((u) => u.username === username);
      if (userData) {
        userData.score = (userData.score || 0) + offlinePoints;
        userData.points = userData.score; // keep legacy/points in sync
        localStorage.setItem("users", JSON.stringify(users));
        localStorage.setItem("points", String(userData.points || userData.score));
      }
      return false;
    }
    
    try {
      // Do not send a hardcoded score — let backend use challenge.points
      const resp = await fetch(
        `${config.API_URL}/challenges/${this.currentChallengeIndex}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}), // empty body => server uses challenge.points
        }
      );

      const data = await resp.json();

      if (!resp.ok) {
        console.warn("Server rejected completion:", data);
        return false;
      }

      // Update currentChallengeIndex from server response (either top-level or inside user)
      if (data.currentChallengeIndex !== undefined) {
        this.currentChallengeIndex = data.currentChallengeIndex;
        localStorage.setItem("currentChallengeIndex", String(this.currentChallengeIndex));
      } else if (data.user && data.user.currentChallengeIndex !== undefined) {
        this.currentChallengeIndex = data.user.currentChallengeIndex;
        localStorage.setItem("currentChallengeIndex", String(this.currentChallengeIndex));
      }

      // Update local users cache with server-provided points
      if (data.user && data.user.points !== undefined) {
        const users = JSON.parse(localStorage.getItem("users")) || [];
        let userEntry = users.find((u) => u.username === username);
        if (userEntry) {
          userEntry.points = data.user.points;
          userEntry.score = data.user.points; // keep legacy value in sync
        } else {
          users.push({ username, profilePic: null, points: data.user.points, score: data.user.points });
        }
        localStorage.setItem("users", JSON.stringify(users));
        localStorage.setItem("points", String(data.user.points));
      }

      this.serverAdvanced = true;
      return true;
    } catch (err) {
      console.error("Error saving progress to server:", err);
      return false;
    }
  }

  showTheory(theoryText) {
    const { width, height } = this.cameras.main;

    this.theoryBack = this.add
      .rectangle(width / 2, height / 2, width - 100, 150, 0x000000, 0.8)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    this.theoryText = this.add
      .text(width / 2, height / 2, theoryText, {
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: width - 150 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);

    this.continueButton = this.add
      .text(width / 2, height / 2 + 70, "Nadaljuj", {
        fontSize: "18px",
        color: "#0066ff",
        backgroundColor: "#ffffff",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () =>
        this.continueButton.setStyle({ color: "#0044cc" })
      )
      .on("pointerout", () =>
        this.continueButton.setStyle({ color: "#0066ff" })
      )
      .on("pointerdown", () => {
        this.hideTheory();
        this.placedComponents.forEach((comp) => comp.destroy());
        this.placedComponents = [];
        this.nextChallenge();
      });
  }

  hideTheory() {
    if (this.theoryBack) {
      this.theoryBack.destroy();
      this.theoryBack = null;
    }
    if (this.theoryText) {
      this.theoryText.destroy();
      this.theoryText = null;
    }
    if (this.continueButton) {
      this.continueButton.destroy();
      this.continueButton = null;
    }
  }

  // ==================== SANDBOX SAVE/LOAD METHODS ====================

  /**
   * Serialize all placed components for saving
   */
  serializeComponents() {
    return this.placedComponents.map(component => {
      const logicComp = component.getData("logicComponent");
      return {
        x: component.x,
        y: component.y,
        type: component.getData("type"),
        rotation: component.getData("rotation") || 0,
        angle: component.angle || 0,
        logicComponent: logicComp ? {
          id: logicComp.id,
          type: logicComp.type,
          is_on: logicComp.is_on,
          voltage: logicComp.voltage,
          ohm: logicComp.ohm
        } : null
      };
    });
  }

  /**
   * Get current camera state
   */
  getCameraState() {
    return {
      x: this.cameras.main.scrollX,
      y: this.cameras.main.scrollY,
      zoom: this.cameras.main.zoom
    };
  }

  /**
   * Save sandbox to database
   */
  async saveSandbox(name = 'Autosave', isAutoSave = true) {
    const token = localStorage.getItem("token");
    if (!token) {
      this.showSandboxNotification("Prosim prijavi se za shranjevanje", 0xff0000);
      return false;
    }

    try {
      const components = this.serializeComponents();
      const cameraPosition = this.getCameraState();

      const endpoint = isAutoSave ? '/sandbox/quicksave' : '/sandbox';
      const response = await fetch(`${config.API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          components,
          cameraPosition,
          isAutoSave
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save sandbox');
      }

      const result = await response.json();
      console.log('[Sandbox] Saved successfully:', result._id);
      this.showSandboxNotification("Shranjeno!", 0x00aa00);
      return result;
    } catch (error) {
      console.error('[Sandbox] Save error:', error);
      this.showSandboxNotification("Napaka pri shranjevanju", 0xff0000);
      return false;
    }
  }

  /**
   * Load sandbox from database
   */
  async loadSandbox(saveId = null) {
    const token = localStorage.getItem("token");
    if (!token) {
      this.showSandboxNotification("Prosim prijavi se za nalaganje", 0xff0000);
      return false;
    }

    try {
      const endpoint = saveId ? `/sandbox/${saveId}` : '/sandbox/autosave';
      const response = await fetch(`${config.API_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 404) {
        this.showSandboxNotification("Ni shranjenih podatkov", 0xffaa00);
        return false;
      }

      if (!response.ok) {
        throw new Error('Failed to load sandbox');
      }

      const save = await response.json();
      
      // Clear existing components
      this.clearSandbox(false);

      // Restore camera position
      if (save.cameraPosition) {
        this.cameras.main.scrollX = save.cameraPosition.x || 0;
        this.cameras.main.scrollY = save.cameraPosition.y || 0;
        this.cameras.main.zoom = save.cameraPosition.zoom || 1;
      }

      // Recreate components
      if (save.components && Array.isArray(save.components)) {
        for (const compData of save.components) {
          const component = this.createComponent(
            compData.x,
            compData.y,
            compData.type,
            this.getColorForType(compData.type),
            { isInPanel: false }
          );

          // Restore rotation
          if (compData.rotation !== undefined) {
            component.setData("rotation", compData.rotation);
            component.setAngle(compData.angle || compData.rotation);
          }

          // Restore logic component state
          const logicComp = component.getData("logicComponent");
          if (logicComp && compData.logicComponent) {
            if (compData.logicComponent.is_on !== undefined) {
              logicComp.is_on = compData.logicComponent.is_on;
            }
            if (compData.logicComponent.voltage !== undefined) {
              logicComp.voltage = compData.logicComponent.voltage;
            }
            if (compData.logicComponent.ohm !== undefined) {
              logicComp.ohm = compData.logicComponent.ohm;
            }
          }

          // Update switch texture based on state
          if (compData.type === 'stikalo-on' || compData.type === 'stikalo-off') {
            const image = component.getData("componentImage");
            if (image && logicComp) {
              image.setTexture(logicComp.is_on ? 'stikalo-on' : 'stikalo-off');
            }
          }

          this.placedComponents.push(component);
          this.updateLogicNodePositions(component);
        }
      }

      this.rebuildGraph();
      console.log('[Sandbox] Loaded successfully:', save._id);
      this.showSandboxNotification("Naloženo!", 0x00aa00);
      return true;
    } catch (error) {
      console.error('[Sandbox] Load error:', error);
      this.showSandboxNotification("Napaka pri nalaganju", 0xff0000);
      return false;
    }
  }

  /**
   * Get all sandbox saves for showing in a list
   */
  async getSandboxSaves() {
    const token = localStorage.getItem("token");
    if (!token) {
      return [];
    }

    try {
      const response = await fetch(`${config.API_URL}/sandbox`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch saves');
      }

      return await response.json();
    } catch (error) {
      console.error('[Sandbox] Error fetching saves:', error);
      return [];
    }
  }

  /**
   * Delete a sandbox save
   */
  async deleteSandboxSave(saveId) {
    const token = localStorage.getItem("token");
    if (!token) return false;

    try {
      const response = await fetch(`${config.API_URL}/sandbox/${saveId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('[Sandbox] Delete error:', error);
      return false;
    }
  }

  /**
   * Clear all placed components from sandbox
   */
  clearSandbox(showNotification = true) {
    // Destroy all placed components
    for (const component of this.placedComponents) {
      component.destroy();
    }
    this.placedComponents = [];

    // Clear electricity visualization
    if (this.electricityParticles) {
      this.electricityParticles.forEach(p => {
        if (p.tween) p.tween.remove();
        p.destroy();
      });
      this.electricityParticles = [];
    }
    if (this.electricityGraphics) {
      this.electricityGraphics.clear();
    }

    // Rebuild empty graph
    this.rebuildGraph();

    if (showNotification) {
      this.showSandboxNotification("Počiščeno!", 0x00aa00);
    }
  }

  /**
   * Get color for component type
   */
  getColorForType(type) {
    const colors = {
      'baterija': 0xffcc00,
      'upor': 0xff6600,
      'svetilka': 0xff0000,
      'stikalo-on': 0x666666,
      'stikalo-off': 0x666666,
      'žica': 0x0066cc,
      'ammeter': 0x00cc66,
      'voltmeter': 0x00cc66
    };
    return colors[type] || 0xffffff;
  }

  /**
   * Show a brief notification message
   */
  showSandboxNotification(message, color = 0x00aa00) {
    const { width, height } = this.cameras.main;
    
    const bg = this.add.rectangle(width / 2, 100, 250, 40, color, 0.9)
      .setOrigin(0.5)
      .setDepth(3000)
      .setScrollFactor(0);
    
    const text = this.add.text(width / 2, 100, message, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
      .setOrigin(0.5)
      .setDepth(3001)
      .setScrollFactor(0);

    // Fade out and destroy
    this.tweens.add({
      targets: [bg, text],
      alpha: 0,
      y: 80,
      duration: 1500,
      delay: 1000,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        bg.destroy();
        text.destroy();
      }
    });
  }

  /**
   * Show sandbox save dialog with name input
   */
  showSaveDialog() {
    const { width, height } = this.cameras.main;

    // Overlay - interactive to block clicks on components underneath
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setOrigin(0.5)
      .setDepth(2000)
      .setScrollFactor(0)
      .setInteractive();

    // Dialog
    const dialogWidth = 400;
    const dialogHeight = 220;
    const dialogBg = this.add.graphics();
    dialogBg.setDepth(2001).setScrollFactor(0);
    dialogBg.fillStyle(0xffffff, 1);
    dialogBg.fillRoundedRect(width / 2 - dialogWidth / 2, height / 2 - dialogHeight / 2, dialogWidth, dialogHeight, 15);
    dialogBg.lineStyle(3, 0x3399ff, 1);
    dialogBg.strokeRoundedRect(width / 2 - dialogWidth / 2, height / 2 - dialogHeight / 2, dialogWidth, dialogHeight, 15);

    const titleText = this.add.text(width / 2, height / 2 - 60, 'Shrani vezje', {
      fontSize: '24px',
      color: '#222',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    // Input
    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.placeholder = 'Ime shranitve...';
    inputField.value = `Vezje ${new Date().toLocaleDateString('sl-SI')}`;
    inputField.style.cssText = `
      position: absolute;
      left: ${width / 2 - 150}px;
      top: ${height / 2 - 15}px;
      width: 300px;
      height: 40px;
      font-size: 16px;
      text-align: center;
      border-radius: 8px;
      border: 2px solid #3399ff;
      outline: none;
      padding: 5px;
      z-index: 3000;
    `;
    document.body.appendChild(inputField);
    inputField.focus();
    inputField.select();

    const closeDialog = () => {
      inputField.remove();
      overlay.destroy();
      dialogBg.destroy();
      titleText.destroy();
      cancelBg.destroy();
      cancelBtn.destroy();
      saveBg.destroy();
      saveBtn.destroy();
    };

    // Buttons
    const buttonWidth = 120;
    const buttonHeight = 40;
    const buttonY = height / 2 + 65;

    const cancelBg = this.add.graphics().setDepth(2001).setScrollFactor(0);
    cancelBg.fillStyle(0xcccccc, 1);
    cancelBg.fillRoundedRect(width / 2 - buttonWidth - 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);

    const cancelBtn = this.add.text(width / 2 - buttonWidth / 2 - 10, buttonY, 'Prekliči', {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', closeDialog);

    const saveBg = this.add.graphics().setDepth(2001).setScrollFactor(0);
    saveBg.fillStyle(0x3399ff, 1);
    saveBg.fillRoundedRect(width / 2 + 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);

    const saveBtn = this.add.text(width / 2 + buttonWidth / 2 + 10, buttonY, 'Shrani', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', async () => {
        const name = inputField.value.trim() || 'Untitled';
        closeDialog();
        await this.saveSandbox(name, false);
      });

    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveBtn.emit('pointerdown');
      else if (e.key === 'Escape') closeDialog();
    });
  }

  /**
   * Show sandbox load dialog with list of saves
   */
  async showLoadDialog() {
    const { width, height } = this.cameras.main;
    const saves = await this.getSandboxSaves();

    // Overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setOrigin(0.5)
      .setDepth(2000)
      .setScrollFactor(0)
      .setInteractive();

    // Dialog
    const dialogWidth = 450;
    const dialogHeight = 350;
    const dialogBg = this.add.graphics();
    dialogBg.setDepth(2001).setScrollFactor(0);
    dialogBg.fillStyle(0xffffff, 1);
    dialogBg.fillRoundedRect(width / 2 - dialogWidth / 2, height / 2 - dialogHeight / 2, dialogWidth, dialogHeight, 15);
    dialogBg.lineStyle(3, 0x3399ff, 1);
    dialogBg.strokeRoundedRect(width / 2 - dialogWidth / 2, height / 2 - dialogHeight / 2, dialogWidth, dialogHeight, 15);

    const titleText = this.add.text(width / 2, height / 2 - dialogHeight / 2 + 30, 'Naloži vezje', {
      fontSize: '24px',
      color: '#222',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    const elements = [overlay, dialogBg, titleText];

    const closeDialog = () => {
      elements.forEach(el => el.destroy());
    };

    // Save list
    const listStartY = height / 2 - dialogHeight / 2 + 70;
    const itemHeight = 45;

    if (saves.length === 0) {
      const noSaves = this.add.text(width / 2, height / 2, 'Ni shranjenih vezij', {
        fontSize: '16px',
        color: '#666'
      }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);
      elements.push(noSaves);
    } else {
      saves.slice(0, 5).forEach((save, index) => {
        const itemY = listStartY + index * itemHeight;
        
        const itemBg = this.add.rectangle(width / 2, itemY, dialogWidth - 40, 40, 0xf0f0f0)
          .setOrigin(0.5)
          .setDepth(2002)
          .setScrollFactor(0)
          .setInteractive({ useHandCursor: true })
          .on('pointerover', () => itemBg.setFillStyle(0xe0e0e0))
          .on('pointerout', () => itemBg.setFillStyle(0xf0f0f0))
          .on('pointerdown', async () => {
            closeDialog();
            await this.loadSandbox(save._id);
          });

        const date = new Date(save.updatedAt).toLocaleString('sl-SI');
        const itemText = this.add.text(width / 2 - dialogWidth / 2 + 40, itemY, 
          `${save.name}${save.isAutoSave ? ' (auto)' : ''}`, {
          fontSize: '14px',
          color: '#222'
        }).setOrigin(0, 0.5).setDepth(2003).setScrollFactor(0);

        const dateText = this.add.text(width / 2 + dialogWidth / 2 - 40, itemY, date, {
          fontSize: '12px',
          color: '#666'
        }).setOrigin(1, 0.5).setDepth(2003).setScrollFactor(0);

        elements.push(itemBg, itemText, dateText);
      });
    }

    // Close button
    const closeBg = this.add.graphics().setDepth(2001).setScrollFactor(0);
    closeBg.fillStyle(0xcccccc, 1);
    closeBg.fillRoundedRect(width / 2 - 60, height / 2 + dialogHeight / 2 - 50, 120, 40, 8);
    elements.push(closeBg);

    const closeBtn = this.add.text(width / 2, height / 2 + dialogHeight / 2 - 30, 'Zapri', {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', closeDialog);
    elements.push(closeBtn);
  }

  // ==================== END SANDBOX METHODS ====================

  showVoltageDialog(logicComp, component) {
    const currentVoltage = logicComp.voltage || 3.3;
    const { width, height } = this.cameras.main;

    // Semi-transparent background overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setOrigin(0.5)
      .setDepth(2000)
      .setScrollFactor(0)
      .setInteractive();

    // Dialog background
    const dialogWidth = 400;
    const dialogHeight = 250;
    const dialogBg = this.add.graphics();
    dialogBg.setDepth(2001);
    dialogBg.setScrollFactor(0);
    dialogBg.fillStyle(0xffffff, 1);
    dialogBg.fillRoundedRect(width / 2 - dialogWidth / 2, height / 2 - dialogHeight / 2, dialogWidth, dialogHeight, 15);
    dialogBg.lineStyle(3, 0x3399ff, 1);
    dialogBg.strokeRoundedRect(width / 2 - dialogWidth / 2, height / 2 - dialogHeight / 2, dialogWidth, dialogHeight, 15);

    // Title
    const titleText = this.add.text(width / 2, height / 2 - 80, 'Nastavi napetost baterije', {
      fontSize: '24px',
      color: '#222',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    // Current voltage display
    const currentText = this.add.text(width / 2, height / 2 - 40, `Trenutna napetost: ${currentVoltage.toFixed(1)} V`, {
      fontSize: '16px',
      color: '#666'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    // HTML Input field
    const inputField = document.createElement('input');
    inputField.type = 'number';
    inputField.value = currentVoltage;
    inputField.min = '0.1';
    inputField.max = '100';
    inputField.step = '0.1';
    inputField.style.position = 'absolute';
    inputField.style.left = `${width / 2 - 100}px`;
    inputField.style.top = `${height / 2 - 5}px`;
    inputField.style.width = '200px';
    inputField.style.height = '40px';
    inputField.style.fontSize = '18px';
    inputField.style.textAlign = 'center';
    inputField.style.borderRadius = '8px';
    inputField.style.border = '2px solid #3399ff';
    inputField.style.outline = 'none';
    inputField.style.padding = '5px';
    inputField.style.zIndex = '3000';
    document.body.appendChild(inputField);
    inputField.focus();

    // Error message
    const errorText = this.add.text(width / 2, height / 2 + 50, '', {
      fontSize: '14px',
      color: '#cc0000'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    // Buttons
    const buttonWidth = 120;
    const buttonHeight = 40;
    const buttonY = height / 2 + 90;

    // Cancel button
    const cancelBg = this.add.graphics();
    cancelBg.setDepth(2001).setScrollFactor(0);
    cancelBg.fillStyle(0xcccccc, 1);
    cancelBg.fillRoundedRect(width / 2 - buttonWidth - 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);

    const cancelBtn = this.add.text(width / 2 - buttonWidth / 2 - 10, buttonY, 'Prekliči', {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        cancelBg.clear();
        cancelBg.fillStyle(0xaaaaaa, 1);
        cancelBg.fillRoundedRect(width / 2 - buttonWidth - 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerout', () => {
        cancelBg.clear();
        cancelBg.fillStyle(0xcccccc, 1);
        cancelBg.fillRoundedRect(width / 2 - buttonWidth - 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerdown', () => {
        inputField.remove();
        overlay.destroy();
        dialogBg.destroy();
        titleText.destroy();
        currentText.destroy();
        errorText.destroy();
        cancelBg.destroy();
        cancelBtn.destroy();
        confirmBg.destroy();
        confirmBtn.destroy();
      });

    // Confirm button
    const confirmBg = this.add.graphics();
    confirmBg.setDepth(2001).setScrollFactor(0);
    confirmBg.fillStyle(0x3399ff, 1);
    confirmBg.fillRoundedRect(width / 2 + 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);

    const confirmBtn = this.add.text(width / 2 + buttonWidth / 2 + 10, buttonY, 'Potrdi', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        confirmBg.clear();
        confirmBg.fillStyle(0x0f5cad, 1);
        confirmBg.fillRoundedRect(width / 2 + 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerout', () => {
        confirmBg.clear();
        confirmBg.fillStyle(0x3399ff, 1);
        confirmBg.fillRoundedRect(width / 2 + 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerdown', () => {
        const voltage = parseFloat(inputField.value);
        if (!isNaN(voltage) && voltage > 0 && voltage <= 100) {
          logicComp.voltage = voltage;
          console.log(`Battery ${logicComp.id} voltage set to ${voltage}V`);
          inputField.remove();
          overlay.destroy();
          dialogBg.destroy();
          titleText.destroy();
          currentText.destroy();
          errorText.destroy();
          cancelBg.destroy();
          cancelBtn.destroy();
          confirmBg.destroy();
          confirmBtn.destroy();
          this.rebuildGraph();
        } else {
          errorText.setText('Prosim vnesi veljavno napetost med 0.1 in 100 V');
        }
      });

    // Allow Enter key to confirm
    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        confirmBtn.emit('pointerdown');
      } else if (e.key === 'Escape') {
        cancelBtn.emit('pointerdown');
      }
    });
  }

  showResistanceDialog(logicComp, component) {
    const currentResistance = logicComp.ohm || 1.5;
    const { width, height } = this.cameras.main;

    // Semi-transparent background overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setOrigin(0.5)
      .setDepth(2000)
      .setScrollFactor(0)
      .setInteractive();

    // Dialog background
    const dialogWidth = 400;
    const dialogHeight = 250;
    const dialogBg = this.add.graphics();
    dialogBg.setDepth(2001);
    dialogBg.setScrollFactor(0);
    dialogBg.fillStyle(0xffffff, 1);
    dialogBg.fillRoundedRect(width / 2 - dialogWidth / 2, height / 2 - dialogHeight / 2, dialogWidth, dialogHeight, 15);
    dialogBg.lineStyle(3, 0xff6600, 1);
    dialogBg.strokeRoundedRect(width / 2 - dialogWidth / 2, height / 2 - dialogHeight / 2, dialogWidth, dialogHeight, 15);

    // Title
    const titleText = this.add.text(width / 2, height / 2 - 80, 'Nastavi upornost upora', {
      fontSize: '24px',
      color: '#222',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    // Current resistance display
    const currentText = this.add.text(width / 2, height / 2 - 40, `Trenutna upornost: ${currentResistance.toFixed(1)} Ω`, {
      fontSize: '16px',
      color: '#666'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    // HTML Input field
    const inputField = document.createElement('input');
    inputField.type = 'number';
    inputField.value = currentResistance;
    inputField.min = '0.1';
    inputField.max = '10000';
    inputField.step = '0.1';
    inputField.style.position = 'absolute';
    inputField.style.left = `${width / 2 - 100}px`;
    inputField.style.top = `${height / 2 - 5}px`;
    inputField.style.width = '200px';
    inputField.style.height = '40px';
    inputField.style.fontSize = '18px';
    inputField.style.textAlign = 'center';
    inputField.style.borderRadius = '8px';
    inputField.style.border = '2px solid #ff6600';
    inputField.style.outline = 'none';
    inputField.style.padding = '5px';
    inputField.style.zIndex = '3000';
    document.body.appendChild(inputField);
    inputField.focus();

    // Error message
    const errorText = this.add.text(width / 2, height / 2 + 50, '', {
      fontSize: '14px',
      color: '#cc0000'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    // Buttons
    const buttonWidth = 120;
    const buttonHeight = 40;
    const buttonY = height / 2 + 90;

    // Cancel button
    const cancelBg = this.add.graphics();
    cancelBg.setDepth(2001).setScrollFactor(0);
    cancelBg.fillStyle(0xcccccc, 1);
    cancelBg.fillRoundedRect(width / 2 - buttonWidth - 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);

    const cancelBtn = this.add.text(width / 2 - buttonWidth / 2 - 10, buttonY, 'Prekliči', {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        cancelBg.clear();
        cancelBg.fillStyle(0xaaaaaa, 1);
        cancelBg.fillRoundedRect(width / 2 - buttonWidth - 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerout', () => {
        cancelBg.clear();
        cancelBg.fillStyle(0xcccccc, 1);
        cancelBg.fillRoundedRect(width / 2 - buttonWidth - 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerdown', () => {
        inputField.remove();
        overlay.destroy();
        dialogBg.destroy();
        titleText.destroy();
        currentText.destroy();
        errorText.destroy();
        cancelBg.destroy();
        cancelBtn.destroy();
        confirmBg.destroy();
        confirmBtn.destroy();
      });

    // Confirm button
    const confirmBg = this.add.graphics();
    confirmBg.setDepth(2001).setScrollFactor(0);
    confirmBg.fillStyle(0xff6600, 1);
    confirmBg.fillRoundedRect(width / 2 + 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);

    const confirmBtn = this.add.text(width / 2 + buttonWidth / 2 + 10, buttonY, 'Potrdi', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        confirmBg.clear();
        confirmBg.fillStyle(0xcc5500, 1);
        confirmBg.fillRoundedRect(width / 2 + 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerout', () => {
        confirmBg.clear();
        confirmBg.fillStyle(0xff6600, 1);
        confirmBg.fillRoundedRect(width / 2 + 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerdown', () => {
        const resistance = parseFloat(inputField.value);
        if (!isNaN(resistance) && resistance > 0 && resistance <= 10000) {
          logicComp.ohm = resistance;
          console.log(`Resistor ${logicComp.id} resistance set to ${resistance}Ω`);
          inputField.remove();
          overlay.destroy();
          dialogBg.destroy();
          titleText.destroy();
          currentText.destroy();
          errorText.destroy();
          cancelBg.destroy();
          cancelBtn.destroy();
          confirmBg.destroy();
          confirmBtn.destroy();
          this.rebuildGraph();
        } else {
          errorText.setText('Prosim vnesi veljavno upornost med 0.1 in 10000 Ω');
        }
      });

    // Allow Enter key to confirm
    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        confirmBtn.emit('pointerdown');
      } else if (e.key === 'Escape') {
        cancelBtn.emit('pointerdown');
      }
    });
  }

  /**
   * Show dialog to adjust bulb wattage or replace burned bulb
   */
  showBulbDialog(logicComp, component) {
    const currentWattage = logicComp.maxWattage || 5;
    const isBurnedOut = logicComp.isBurnedOut || false;
    const { width, height } = this.cameras.main;

    // Semi-transparent background overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setOrigin(0.5)
      .setDepth(2000)
      .setScrollFactor(0)
      .setInteractive();

    // Dialog background
    const dialogWidth = 400;
    const dialogHeight = isBurnedOut ? 300 : 250;
    const dialogBg = this.add.graphics();
    dialogBg.setDepth(2001);
    dialogBg.setScrollFactor(0);
    dialogBg.fillStyle(0xffffff, 1);
    dialogBg.fillRoundedRect(width / 2 - dialogWidth / 2, height / 2 - dialogHeight / 2, dialogWidth, dialogHeight, 15);
    dialogBg.lineStyle(3, isBurnedOut ? 0xcc0000 : 0xffcc00, 1);
    dialogBg.strokeRoundedRect(width / 2 - dialogWidth / 2, height / 2 - dialogHeight / 2, dialogWidth, dialogHeight, 15);

    // Title
    const titleText = this.add.text(width / 2, height / 2 - (isBurnedOut ? 110 : 80), 
      isBurnedOut ? '💥 Žarnica je pregorela!' : 'Nastavi moč žarnice', {
      fontSize: '22px',
      color: isBurnedOut ? '#cc0000' : '#222',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    // Current wattage display
    const currentText = this.add.text(width / 2, height / 2 - (isBurnedOut ? 70 : 40), 
      `Maksimalna moč: ${currentWattage.toFixed(1)} W`, {
      fontSize: '16px',
      color: '#666'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    // Burned out explanation
    let burnedText = null;
    if (isBurnedOut) {
      burnedText = this.add.text(width / 2, height / 2 - 35, 
        'Žarnica je pregorela zaradi prevelike moči.\nKlikni "Zamenjaj" za novo žarnico.', {
        fontSize: '14px',
        color: '#666',
        align: 'center'
      }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);
    }

    // HTML Input field (for wattage)
    const inputField = document.createElement('input');
    inputField.type = 'number';
    inputField.value = currentWattage;
    inputField.min = '1';
    inputField.max = '100';
    inputField.step = '0.5';
    inputField.style.position = 'absolute';
    inputField.style.left = `${width / 2 - 100}px`;
    inputField.style.top = `${height / 2 + (isBurnedOut ? 15 : -5)}px`;
    inputField.style.width = '200px';
    inputField.style.height = '40px';
    inputField.style.fontSize = '18px';
    inputField.style.textAlign = 'center';
    inputField.style.borderRadius = '8px';
    inputField.style.border = `2px solid ${isBurnedOut ? '#cc0000' : '#ffcc00'}`;
    inputField.style.outline = 'none';
    inputField.style.padding = '5px';
    inputField.style.zIndex = '3000';
    document.body.appendChild(inputField);
    inputField.focus();

    // Error message
    const errorText = this.add.text(width / 2, height / 2 + (isBurnedOut ? 70 : 50), '', {
      fontSize: '14px',
      color: '#cc0000'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    // Buttons
    const buttonWidth = isBurnedOut ? 100 : 120;
    const buttonHeight = 40;
    const buttonY = height / 2 + (isBurnedOut ? 115 : 90);

    // Helper to clean up dialog
    const closeDialog = () => {
      inputField.remove();
      overlay.destroy();
      dialogBg.destroy();
      titleText.destroy();
      currentText.destroy();
      errorText.destroy();
      cancelBg.destroy();
      cancelBtn.destroy();
      confirmBg.destroy();
      confirmBtn.destroy();
      if (burnedText) burnedText.destroy();
      if (replaceBg) replaceBg.destroy();
      if (replaceBtn) replaceBtn.destroy();
    };

    // Cancel button
    const cancelBg = this.add.graphics();
    cancelBg.setDepth(2001).setScrollFactor(0);
    cancelBg.fillStyle(0xcccccc, 1);
    const cancelX = isBurnedOut ? width / 2 - buttonWidth * 1.5 - 15 : width / 2 - buttonWidth - 10;
    cancelBg.fillRoundedRect(cancelX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);

    const cancelBtn = this.add.text(cancelX + buttonWidth / 2, buttonY, 'Prekliči', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        cancelBg.clear();
        cancelBg.fillStyle(0xaaaaaa, 1);
        cancelBg.fillRoundedRect(cancelX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerout', () => {
        cancelBg.clear();
        cancelBg.fillStyle(0xcccccc, 1);
        cancelBg.fillRoundedRect(cancelX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerdown', closeDialog);

    // Replace button (only if burned out)
    let replaceBg = null;
    let replaceBtn = null;
    if (isBurnedOut) {
      replaceBg = this.add.graphics();
      replaceBg.setDepth(2001).setScrollFactor(0);
      replaceBg.fillStyle(0x00aa00, 1);
      const replaceX = width / 2 - buttonWidth / 2;
      replaceBg.fillRoundedRect(replaceX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);

      replaceBtn = this.add.text(replaceX + buttonWidth / 2, buttonY, 'Zamenjaj', {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(2002).setScrollFactor(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          replaceBg.clear();
          replaceBg.fillStyle(0x008800, 1);
          replaceBg.fillRoundedRect(replaceX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
        })
        .on('pointerout', () => {
          replaceBg.clear();
          replaceBg.fillStyle(0x00aa00, 1);
          replaceBg.fillRoundedRect(replaceX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
        })
        .on('pointerdown', () => {
          const newWattage = parseFloat(inputField.value);
          if (!isNaN(newWattage) && newWattage >= 1 && newWattage <= 100) {
            // Replace the bulb (fix it and set new wattage)
            logicComp.replace();
            logicComp.maxWattage = newWattage;
            console.log(`Bulb ${logicComp.id} replaced with ${newWattage}W capacity`);
            closeDialog();
            this.rebuildGraph();
          } else {
            errorText.setText('Prosim vnesi veljavno moč med 1 in 100 W');
          }
        });
    }

    // Confirm button (set wattage)
    const confirmBg = this.add.graphics();
    confirmBg.setDepth(2001).setScrollFactor(0);
    confirmBg.fillStyle(0xffcc00, 1);
    const confirmX = isBurnedOut ? width / 2 + buttonWidth / 2 + 15 : width / 2 + 10;
    confirmBg.fillRoundedRect(confirmX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);

    const confirmBtn = this.add.text(confirmX + buttonWidth / 2, buttonY, 'Potrdi', {
      fontSize: '16px',
      color: '#222',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        confirmBg.clear();
        confirmBg.fillStyle(0xccaa00, 1);
        confirmBg.fillRoundedRect(confirmX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerout', () => {
        confirmBg.clear();
        confirmBg.fillStyle(0xffcc00, 1);
        confirmBg.fillRoundedRect(confirmX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerdown', () => {
        const wattage = parseFloat(inputField.value);
        if (!isNaN(wattage) && wattage >= 1 && wattage <= 100) {
          logicComp.maxWattage = wattage;
          console.log(`Bulb ${logicComp.id} max wattage set to ${wattage}W`);
          closeDialog();
          this.rebuildGraph();
        } else {
          errorText.setText('Prosim vnesi veljavno moč med 1 in 100 W');
        }
      });

    // Allow Enter key to confirm
    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (isBurnedOut) {
          replaceBtn.emit('pointerdown');
        } else {
          confirmBtn.emit('pointerdown');
        }
      } else if (e.key === 'Escape') {
        cancelBtn.emit('pointerdown');
      }
    });
  }

  /**
   * Show dialog to select wire color
   */
  showWireColorDialog(logicComp, component) {
    const currentColor = logicComp.wireColor || 'black';
    const { width, height } = this.cameras.main;
    const colors = WIRE_COLORS;

    // Semi-transparent background overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setOrigin(0.5)
      .setDepth(2000)
      .setScrollFactor(0)
      .setInteractive();

    // Dialog background
    const dialogWidth = 350;
    const dialogHeight = 280;
    const dialogBg = this.add.graphics();
    dialogBg.setDepth(2001);
    dialogBg.setScrollFactor(0);
    dialogBg.fillStyle(0xffffff, 1);
    dialogBg.fillRoundedRect(width / 2 - dialogWidth / 2, height / 2 - dialogHeight / 2, dialogWidth, dialogHeight, 15);
    dialogBg.lineStyle(3, 0x0066cc, 1);
    dialogBg.strokeRoundedRect(width / 2 - dialogWidth / 2, height / 2 - dialogHeight / 2, dialogWidth, dialogHeight, 15);

    // Title
    const titleText = this.add.text(width / 2, height / 2 - 110, 'Izberi barvo žice', {
      fontSize: '22px',
      color: '#222',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    // Color grid
    const colorKeys = Object.keys(colors);
    const colorsPerRow = 4;
    const colorBoxSize = 50;
    const colorGap = 15;
    const startX = width / 2 - ((colorsPerRow * (colorBoxSize + colorGap)) - colorGap) / 2;
    const startY = height / 2 - 50;

    const allElements = []; // Track all elements for cleanup

    // Helper to clean up dialog
    const closeDialog = () => {
      overlay.destroy();
      dialogBg.destroy();
      titleText.destroy();
      allElements.forEach(el => {
        if (el && el.destroy) el.destroy();
      });
      cancelBg.destroy();
      cancelBtn.destroy();
    };

    colorKeys.forEach((colorKey, index) => {
      const col = index % colorsPerRow;
      const row = Math.floor(index / colorsPerRow);
      const x = startX + col * (colorBoxSize + colorGap) + colorBoxSize / 2;
      const y = startY + row * (colorBoxSize + colorGap + 20);

      // Color box background
      const colorBg = this.add.graphics();
      colorBg.setDepth(2001).setScrollFactor(0);
      
      // Handle 'none' option specially - show a gradient/pattern
      const boxColor = colors[colorKey].hex !== null ? colors[colorKey].hex : 0x888888;
      colorBg.fillStyle(boxColor, 1);
      colorBg.fillRoundedRect(x - colorBoxSize / 2, y - colorBoxSize / 2, colorBoxSize, colorBoxSize, 8);
      
      // For 'none' option, add a diagonal line pattern to indicate "original"
      if (colors[colorKey].hex === null) {
        colorBg.lineStyle(2, 0x444444, 1);
        colorBg.lineBetween(x - colorBoxSize / 2 + 5, y + colorBoxSize / 2 - 5, x + colorBoxSize / 2 - 5, y - colorBoxSize / 2 + 5);
      }
      
      // Add border for current selection
      if (colorKey === currentColor) {
        colorBg.lineStyle(3, 0x000000, 1);
        colorBg.strokeRoundedRect(x - colorBoxSize / 2, y - colorBoxSize / 2, colorBoxSize, colorBoxSize, 8);
      }
      allElements.push(colorBg);

      // Color name label
      const colorLabel = this.add.text(x, y + colorBoxSize / 2 + 10, colors[colorKey].name, {
        fontSize: '11px',
        color: '#333'
      }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);
      allElements.push(colorLabel);

      // Interactive zone
      const hitArea = this.add.rectangle(x, y, colorBoxSize, colorBoxSize, 0x000000, 0)
        .setOrigin(0.5)
        .setDepth(2003)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          colorBg.clear();
          colorBg.fillStyle(boxColor, 1);
          colorBg.fillRoundedRect(x - colorBoxSize / 2, y - colorBoxSize / 2, colorBoxSize, colorBoxSize, 8);
          if (colors[colorKey].hex === null) {
            colorBg.lineStyle(2, 0x444444, 1);
            colorBg.lineBetween(x - colorBoxSize / 2 + 5, y + colorBoxSize / 2 - 5, x + colorBoxSize / 2 - 5, y - colorBoxSize / 2 + 5);
          }
          colorBg.lineStyle(2, 0x000000, 0.5);
          colorBg.strokeRoundedRect(x - colorBoxSize / 2, y - colorBoxSize / 2, colorBoxSize, colorBoxSize, 8);
        })
        .on('pointerout', () => {
          colorBg.clear();
          colorBg.fillStyle(boxColor, 1);
          colorBg.fillRoundedRect(x - colorBoxSize / 2, y - colorBoxSize / 2, colorBoxSize, colorBoxSize, 8);
          if (colors[colorKey].hex === null) {
            colorBg.lineStyle(2, 0x444444, 1);
            colorBg.lineBetween(x - colorBoxSize / 2 + 5, y + colorBoxSize / 2 - 5, x + colorBoxSize / 2 - 5, y - colorBoxSize / 2 + 5);
          }
          if (colorKey === currentColor) {
            colorBg.lineStyle(3, 0x000000, 1);
            colorBg.strokeRoundedRect(x - colorBoxSize / 2, y - colorBoxSize / 2, colorBoxSize, colorBoxSize, 8);
          }
        })
        .on('pointerdown', () => {
          // Set the wire color
          logicComp.wireColor = colorKey;
          
          // Apply tint to wire image - try multiple ways to find it
          let wireImage = component.getData("componentImage");
          if (!wireImage) {
            // Try to find Image in container's children
            for (const child of component.list) {
              if (child.type === 'Image') {
                wireImage = child;
                break;
              }
            }
          }
          if (!wireImage) {
            wireImage = component.list[0];
          }
          
          console.log(`Wire color change - colorKey: ${colorKey}, wireImage:`, wireImage);
          console.log(`Component list:`, component.list);
          
          if (wireImage) {
            if (colorKey === 'none' || colors[colorKey].hex === null) {
              wireImage.clearTint();
              console.log(`Wire ${logicComp.id} tint cleared`);
            } else {
              // Use setTintFill for solid color overlay
              wireImage.setTintFill(colors[colorKey].hex);
              console.log(`Wire ${logicComp.id} tintFill applied: 0x${colors[colorKey].hex.toString(16)}`);
            }
          } else {
            console.warn(`Could not find wire image to apply tint`);
          }
          
          // Set a longer cooldown to prevent dialog from reopening
          this.dialogCooldown = true;
          this.time.delayedCall(800, () => { this.dialogCooldown = false; });
          
          closeDialog();
        });
      allElements.push(hitArea);
    });

    // Cancel button
    const buttonWidth = 120;
    const buttonHeight = 40;
    const buttonY = height / 2 + 105;

    const cancelBg = this.add.graphics();
    cancelBg.setDepth(2001).setScrollFactor(0);
    cancelBg.fillStyle(0xcccccc, 1);
    cancelBg.fillRoundedRect(width / 2 - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);

    const cancelBtn = this.add.text(width / 2, buttonY, 'Zapri', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        cancelBg.clear();
        cancelBg.fillStyle(0xaaaaaa, 1);
        cancelBg.fillRoundedRect(width / 2 - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerout', () => {
        cancelBg.clear();
        cancelBg.fillStyle(0xcccccc, 1);
        cancelBg.fillRoundedRect(width / 2 - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerdown', () => {
        // Set cooldown to prevent dialog from reopening
        this.dialogCooldown = true;
        this.time.delayedCall(800, () => { this.dialogCooldown = false; });
        closeDialog();
      });
  }

  /**
   * Show dialog to select LED color or replace burned LED
   */
  showLEDDialog(logicComp, component) {
    const currentColor = logicComp.ledColor || 'red';
    const currentMaxCurrent = logicComp.maxCurrent || 5;
    const isBurnedOut = logicComp.isBurnedOut || false;
    const { width, height } = this.cameras.main;
    const colors = LED_COLORS;

    // Semi-transparent background overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setOrigin(0.5)
      .setDepth(2000)
      .setScrollFactor(0)
      .setInteractive();

    // Dialog background - larger to accommodate input field
    const dialogWidth = 400;
    const dialogHeight = isBurnedOut ? 420 : 380;
    const dialogBg = this.add.graphics();
    dialogBg.setDepth(2001);
    dialogBg.setScrollFactor(0);
    dialogBg.fillStyle(0xffffff, 1);
    dialogBg.fillRoundedRect(width / 2 - dialogWidth / 2, height / 2 - dialogHeight / 2, dialogWidth, dialogHeight, 15);
    dialogBg.lineStyle(3, isBurnedOut ? 0xcc0000 : colors[currentColor].hex, 1);
    dialogBg.strokeRoundedRect(width / 2 - dialogWidth / 2, height / 2 - dialogHeight / 2, dialogWidth, dialogHeight, 15);

    // Title
    const titleText = this.add.text(width / 2, height / 2 - (isBurnedOut ? 175 : 155), 
      isBurnedOut ? '💥 LED je pregorela!' : 'Nastavi LED', {
      fontSize: '22px',
      color: isBurnedOut ? '#cc0000' : '#222',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    // Current info
    const currentText = this.add.text(width / 2, height / 2 - (isBurnedOut ? 140 : 120), 
      `Trenutna barva: ${colors[currentColor].name} | Max tok: ${currentMaxCurrent * 1000} mA`, {
      fontSize: '14px',
      color: '#666'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    // Burned out explanation
    let burnedText = null;
    if (isBurnedOut) {
      burnedText = this.add.text(width / 2, height / 2 - 105, 
        'LED je pregorela zaradi prevelikega toka.\nIzberi novo barvo za zamenjavo.', {
        fontSize: '14px',
        color: '#666',
        align: 'center'
      }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);
    }

    const allElements = [];

    // Max current input section
    const maxCurrentLabel = this.add.text(width / 2 - 140, height / 2 + (isBurnedOut ? 70 : 50), 'Max tok (mA):', {
      fontSize: '14px',
      color: '#333'
    }).setOrigin(0, 0.5).setDepth(2002).setScrollFactor(0);
    allElements.push(maxCurrentLabel);

    // HTML Input field for max current
    const inputField = document.createElement('input');
    inputField.type = 'number';
    inputField.value = (currentMaxCurrent * 1000).toFixed(0); // Show in mA
    inputField.min = '10';
    inputField.max = '50000';
    inputField.step = '10';
    inputField.style.position = 'absolute';
    inputField.style.left = `${width / 2 - 20}px`;
    inputField.style.top = `${height / 2 + (isBurnedOut ? 55 : 35)}px`;
    inputField.style.width = '120px';
    inputField.style.height = '30px';
    inputField.style.fontSize = '14px';
    inputField.style.textAlign = 'center';
    inputField.style.borderRadius = '6px';
    inputField.style.border = '2px solid #888';
    inputField.style.outline = 'none';
    inputField.style.padding = '3px';
    inputField.style.zIndex = '3000';
    document.body.appendChild(inputField);

    // Error message
    const errorText = this.add.text(width / 2, height / 2 + (isBurnedOut ? 100 : 80), '', {
      fontSize: '12px',
      color: '#cc0000'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);
    allElements.push(errorText);

    // Helper to clean up dialog
    const closeDialog = () => {
      inputField.remove();
      overlay.destroy();
      dialogBg.destroy();
      titleText.destroy();
      currentText.destroy();
      cancelBg.destroy();
      cancelBtn.destroy();
      confirmBg.destroy();
      confirmBtn.destroy();
      if (burnedText) burnedText.destroy();
      allElements.forEach(el => { if (el && el.destroy) el.destroy(); });
    };

    // Color grid
    const colorKeys = Object.keys(colors);
    const colorsPerRow = 5;
    const colorBoxSize = 55;
    const colorGap = 12;
    const startX = width / 2 - ((colorsPerRow * (colorBoxSize + colorGap)) - colorGap) / 2;
    const startY = height / 2 - (isBurnedOut ? 55 : 75);

    colorKeys.forEach((colorKey, index) => {
      const col = index % colorsPerRow;
      const row = Math.floor(index / colorsPerRow);
      const x = startX + col * (colorBoxSize + colorGap) + colorBoxSize / 2;
      const y = startY + row * (colorBoxSize + colorGap + 22);

      // Color box background with LED color
      const colorBg = this.add.graphics();
      colorBg.setDepth(2001).setScrollFactor(0);
      colorBg.fillStyle(colors[colorKey].hex, 1);
      colorBg.fillRoundedRect(x - colorBoxSize / 2, y - colorBoxSize / 2, colorBoxSize, colorBoxSize, 8);
      
      // Add border for current selection
      if (colorKey === currentColor) {
        colorBg.lineStyle(3, 0x000000, 1);
        colorBg.strokeRoundedRect(x - colorBoxSize / 2, y - colorBoxSize / 2, colorBoxSize, colorBoxSize, 8);
      }
      allElements.push(colorBg);

      // Color name label
      const colorLabel = this.add.text(x, y + colorBoxSize / 2 + 10, colors[colorKey].name, {
        fontSize: '11px',
        color: '#333'
      }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);
      allElements.push(colorLabel);

      // Interactive zone
      const hitArea = this.add.rectangle(x, y, colorBoxSize, colorBoxSize, 0x000000, 0)
        .setOrigin(0.5)
        .setDepth(2003)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          colorBg.clear();
          colorBg.fillStyle(colors[colorKey].hex, 1);
          colorBg.fillRoundedRect(x - colorBoxSize / 2, y - colorBoxSize / 2, colorBoxSize, colorBoxSize, 8);
          colorBg.lineStyle(2, 0x000000, 0.5);
          colorBg.strokeRoundedRect(x - colorBoxSize / 2, y - colorBoxSize / 2, colorBoxSize, colorBoxSize, 8);
        })
        .on('pointerout', () => {
          colorBg.clear();
          colorBg.fillStyle(colors[colorKey].hex, 1);
          colorBg.fillRoundedRect(x - colorBoxSize / 2, y - colorBoxSize / 2, colorBoxSize, colorBoxSize, 8);
          if (colorKey === currentColor) {
            colorBg.lineStyle(3, 0x000000, 1);
            colorBg.strokeRoundedRect(x - colorBoxSize / 2, y - colorBoxSize / 2, colorBoxSize, colorBoxSize, 8);
          }
        })
        .on('pointerdown', () => {
          // Validate max current input
          const maxCurrentMa = parseFloat(inputField.value);
          if (isNaN(maxCurrentMa) || maxCurrentMa < 10 || maxCurrentMa > 50000) {
            errorText.setText('Vnesi veljaven tok med 10 in 50000 mA');
            return;
          }
          
          // Set the LED color and max current, replace if burned out
          if (isBurnedOut) {
            logicComp.replace();
          }
          logicComp.setColor(colorKey);
          logicComp.maxCurrent = maxCurrentMa / 1000; // Convert mA to A
          console.log(`LED ${logicComp.id} color set to ${colorKey}, max current: ${maxCurrentMa}mA${isBurnedOut ? ' (replaced)' : ''}`);
          
          // Set cooldown to prevent dialog from reopening
          this.dialogCooldown = true;
          this.time.delayedCall(800, () => { this.dialogCooldown = false; });
          
          closeDialog();
          this.rebuildGraph();
        });
      allElements.push(hitArea);
    });

    // Buttons
    const buttonWidth = 100;
    const buttonHeight = 40;
    const buttonY = height / 2 + (isBurnedOut ? 160 : 140);

    // Cancel button
    const cancelBg = this.add.graphics();
    cancelBg.setDepth(2001).setScrollFactor(0);
    cancelBg.fillStyle(0xcccccc, 1);
    cancelBg.fillRoundedRect(width / 2 - buttonWidth - 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);

    const cancelBtn = this.add.text(width / 2 - buttonWidth / 2 - 10, buttonY, 'Prekliči', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        cancelBg.clear();
        cancelBg.fillStyle(0xaaaaaa, 1);
        cancelBg.fillRoundedRect(width / 2 - buttonWidth - 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerout', () => {
        cancelBg.clear();
        cancelBg.fillStyle(0xcccccc, 1);
        cancelBg.fillRoundedRect(width / 2 - buttonWidth - 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerdown', () => {
        // Set cooldown to prevent dialog from reopening
        this.dialogCooldown = true;
        this.time.delayedCall(800, () => { this.dialogCooldown = false; });
        closeDialog();
      });

    // Confirm button (saves max current without changing color)
    const confirmBg = this.add.graphics();
    confirmBg.setDepth(2001).setScrollFactor(0);
    confirmBg.fillStyle(0x44aa44, 1);
    confirmBg.fillRoundedRect(width / 2 + 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);

    const confirmBtn = this.add.text(width / 2 + buttonWidth / 2 + 10, buttonY, 'Potrdi', {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        confirmBg.clear();
        confirmBg.fillStyle(0x338833, 1);
        confirmBg.fillRoundedRect(width / 2 + 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerout', () => {
        confirmBg.clear();
        confirmBg.fillStyle(0x44aa44, 1);
        confirmBg.fillRoundedRect(width / 2 + 10, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerdown', () => {
        // Validate max current input
        const maxCurrentMa = parseFloat(inputField.value);
        if (isNaN(maxCurrentMa) || maxCurrentMa < 10 || maxCurrentMa > 50000) {
          errorText.setText('Vnesi veljaven tok med 10 in 50000 mA');
          return;
        }
        
        // Update max current only (keep current color)
        if (isBurnedOut) {
          logicComp.replace();
        }
        logicComp.maxCurrent = maxCurrentMa / 1000; // Convert mA to A
        console.log(`LED ${logicComp.id} max current set to ${maxCurrentMa}mA${isBurnedOut ? ' (replaced)' : ''}`);
        
        // Set cooldown to prevent dialog from reopening
        this.dialogCooldown = true;
        this.time.delayedCall(800, () => { this.dialogCooldown = false; });
        
        closeDialog();
        this.rebuildGraph();
      });

    // Allow Enter key to confirm
    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        confirmBtn.emit('pointerdown');
      } else if (e.key === 'Escape') {
        cancelBtn.emit('pointerdown');
      }
    });
  }

  /**
   * Show dialog to adjust fuse rating or replace blown fuse
   */
  showFuseDialog(logicComp, component) {
    const currentRating = logicComp.maxCurrent || 1;
    const isBlown = logicComp.isBlown || false;
    const { width, height } = this.cameras.main;

    // Semi-transparent background overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setOrigin(0.5)
      .setDepth(2000)
      .setScrollFactor(0)
      .setInteractive();

    // Dialog background
    const dialogWidth = 400;
    const dialogHeight = isBlown ? 300 : 250;
    const dialogBg = this.add.graphics();
    dialogBg.setDepth(2001);
    dialogBg.setScrollFactor(0);
    dialogBg.fillStyle(0xffffff, 1);
    dialogBg.fillRoundedRect(width / 2 - dialogWidth / 2, height / 2 - dialogHeight / 2, dialogWidth, dialogHeight, 15);
    dialogBg.lineStyle(3, isBlown ? 0xcc0000 : 0x888888, 1);
    dialogBg.strokeRoundedRect(width / 2 - dialogWidth / 2, height / 2 - dialogHeight / 2, dialogWidth, dialogHeight, 15);

    // Title
    const titleText = this.add.text(width / 2, height / 2 - (isBlown ? 110 : 80), 
      isBlown ? '💥 Varovalka je pregorela!' : 'Nastavi vrednost varovalke', {
      fontSize: '22px',
      color: isBlown ? '#cc0000' : '#222',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    // Current rating display
    const currentText = this.add.text(width / 2, height / 2 - (isBlown ? 70 : 40), 
      `Maksimalni tok: ${currentRating.toFixed(2)} A (${(currentRating * 1000).toFixed(0)} mA)`, {
      fontSize: '16px',
      color: '#666'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    // Blown explanation
    let blownText = null;
    if (isBlown) {
      blownText = this.add.text(width / 2, height / 2 - 35, 
        'Varovalka je pregorela zaradi prevelikega toka.\nKlikni "Zamenjaj" za novo varovalko.', {
        fontSize: '14px',
        color: '#666',
        align: 'center'
      }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);
    }

    // HTML Input field (for rating in mA for easier input)
    const inputField = document.createElement('input');
    inputField.type = 'number';
    inputField.value = (currentRating * 1000).toFixed(0); // Show in mA
    inputField.min = '10';
    inputField.max = '10000';
    inputField.step = '10';
    inputField.style.position = 'absolute';
    inputField.style.left = `${width / 2 - 100}px`;
    inputField.style.top = `${height / 2 + (isBlown ? 15 : -5)}px`;
    inputField.style.width = '200px';
    inputField.style.height = '40px';
    inputField.style.fontSize = '18px';
    inputField.style.textAlign = 'center';
    inputField.style.borderRadius = '8px';
    inputField.style.border = `2px solid ${isBlown ? '#cc0000' : '#888888'}`;
    inputField.style.outline = 'none';
    inputField.style.padding = '5px';
    inputField.style.zIndex = '3000';
    document.body.appendChild(inputField);
    inputField.focus();

    // Unit label
    const unitLabel = this.add.text(width / 2 + 130, height / 2 + (isBlown ? 35 : 15), 'mA', {
      fontSize: '18px',
      color: '#666'
    }).setOrigin(0, 0.5).setDepth(2002).setScrollFactor(0);

    // Error message
    const errorText = this.add.text(width / 2, height / 2 + (isBlown ? 70 : 50), '', {
      fontSize: '14px',
      color: '#cc0000'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

    // Buttons
    const buttonWidth = isBlown ? 100 : 120;
    const buttonHeight = 40;
    const buttonY = height / 2 + (isBlown ? 115 : 90);

    // Helper to clean up dialog
    const closeDialog = () => {
      inputField.remove();
      overlay.destroy();
      dialogBg.destroy();
      titleText.destroy();
      currentText.destroy();
      unitLabel.destroy();
      errorText.destroy();
      cancelBg.destroy();
      cancelBtn.destroy();
      confirmBg.destroy();
      confirmBtn.destroy();
      if (blownText) blownText.destroy();
      if (replaceBg) replaceBg.destroy();
      if (replaceBtn) replaceBtn.destroy();
    };

    // Cancel button
    const cancelBg = this.add.graphics();
    cancelBg.setDepth(2001).setScrollFactor(0);
    cancelBg.fillStyle(0xcccccc, 1);
    const cancelX = isBlown ? width / 2 - buttonWidth * 1.5 - 15 : width / 2 - buttonWidth - 10;
    cancelBg.fillRoundedRect(cancelX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);

    const cancelBtn = this.add.text(cancelX + buttonWidth / 2, buttonY, 'Prekliči', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        cancelBg.clear();
        cancelBg.fillStyle(0xaaaaaa, 1);
        cancelBg.fillRoundedRect(cancelX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerout', () => {
        cancelBg.clear();
        cancelBg.fillStyle(0xcccccc, 1);
        cancelBg.fillRoundedRect(cancelX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerdown', () => {
        this.dialogCooldown = true;
        this.time.delayedCall(800, () => { this.dialogCooldown = false; });
        closeDialog();
      });

    // Replace button (only if blown)
    let replaceBg = null;
    let replaceBtn = null;
    if (isBlown) {
      replaceBg = this.add.graphics();
      replaceBg.setDepth(2001).setScrollFactor(0);
      replaceBg.fillStyle(0x00aa00, 1);
      const replaceX = width / 2 - buttonWidth / 2;
      replaceBg.fillRoundedRect(replaceX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);

      replaceBtn = this.add.text(replaceX + buttonWidth / 2, buttonY, 'Zamenjaj', {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(2002).setScrollFactor(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          replaceBg.clear();
          replaceBg.fillStyle(0x008800, 1);
          replaceBg.fillRoundedRect(replaceX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
        })
        .on('pointerout', () => {
          replaceBg.clear();
          replaceBg.fillStyle(0x00aa00, 1);
          replaceBg.fillRoundedRect(replaceX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
        })
        .on('pointerdown', () => {
          const ratingMa = parseFloat(inputField.value);
          if (!isNaN(ratingMa) && ratingMa >= 10 && ratingMa <= 10000) {
            // Replace the fuse (fix it and set new rating)
            logicComp.replace();
            logicComp.maxCurrent = ratingMa / 1000; // Convert mA to A
            console.log(`Fuse ${logicComp.id} replaced with ${ratingMa} mA rating`);
            this.dialogCooldown = true;
            this.time.delayedCall(800, () => { this.dialogCooldown = false; });
            closeDialog();
            this.rebuildGraph();
          } else {
            errorText.setText('Prosim vnesi veljavno vrednost med 10 in 10000 mA');
          }
        });
    }

    // Confirm button (set rating)
    const confirmBg = this.add.graphics();
    confirmBg.setDepth(2001).setScrollFactor(0);
    confirmBg.fillStyle(0x888888, 1);
    const confirmX = isBlown ? width / 2 + buttonWidth / 2 + 15 : width / 2 + 10;
    confirmBg.fillRoundedRect(confirmX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);

    const confirmBtn = this.add.text(confirmX + buttonWidth / 2, buttonY, 'Potrdi', {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        confirmBg.clear();
        confirmBg.fillStyle(0x666666, 1);
        confirmBg.fillRoundedRect(confirmX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerout', () => {
        confirmBg.clear();
        confirmBg.fillStyle(0x888888, 1);
        confirmBg.fillRoundedRect(confirmX, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      })
      .on('pointerdown', () => {
        const ratingMa = parseFloat(inputField.value);
        if (!isNaN(ratingMa) && ratingMa >= 10 && ratingMa <= 10000) {
          logicComp.maxCurrent = ratingMa / 1000; // Convert mA to A
          console.log(`Fuse ${logicComp.id} rating set to ${ratingMa} mA`);
          this.dialogCooldown = true;
          this.time.delayedCall(800, () => { this.dialogCooldown = false; });
          closeDialog();
          this.rebuildGraph();
        } else {
          errorText.setText('Prosim vnesi veljavno vrednost med 10 in 10000 mA');
        }
      });

    // Allow Enter key to confirm
    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (isBlown) {
          replaceBtn.emit('pointerdown');
        } else {
          confirmBtn.emit('pointerdown');
        }
      } else if (e.key === 'Escape') {
        cancelBtn.emit('pointerdown');
      }
    });
  }

  /**
   * Create a minimap for navigation in the infinite workspace
   */
  createMinimap() {
    const { width, height } = this.cameras.main;
    
    // Minimap size modes: small (default) and large (toggled with M)
    this.minimapExpanded = false;
    this.minimapSmallWidth = 180;
    this.minimapSmallHeight = 140;
    this.minimapLargeWidth = 350;
    this.minimapLargeHeight = 280;
    
    // Current size
    this.minimapWidth = this.minimapSmallWidth;
    this.minimapHeight = this.minimapSmallHeight;
    this.minimapPadding = 15;
    this.minimapX = width - this.minimapWidth - this.minimapPadding;
    this.minimapY = height - this.minimapHeight - this.minimapPadding;
    
    // Calculate scale factor for minimap
    this.minimapScaleX = this.minimapWidth / this.canvasWidth;
    this.minimapScaleY = this.minimapHeight / this.canvasHeight;
    
    // Create minimap container (fixed to screen)
    this.minimapContainer = this.add.container(this.minimapX, this.minimapY);
    this.minimapContainer.setScrollFactor(0);
    this.minimapContainer.setDepth(950);
    
    // Minimap background
    this.minimapBg = this.add.rectangle(
      0, 0,
      this.minimapWidth, this.minimapHeight,
      0xd4c4a8, 1
    ).setOrigin(0);
    this.minimapBg.setStrokeStyle(2, 0x4a3c2a);
    this.minimapContainer.add(this.minimapBg);
    
    // Minimap grid graphics (will be redrawn on resize)
    this.minimapGrid = this.add.graphics();
    this.minimapContainer.add(this.minimapGrid);
    this.drawMinimapGrid();
    
    // Graphics for component dots
    this.minimapComponentsGraphics = this.add.graphics();
    this.minimapContainer.add(this.minimapComponentsGraphics);
    
    // Viewport indicator (shows current camera view)
    this.minimapViewport = this.add.graphics();
    this.minimapContainer.add(this.minimapViewport);
    
    // Center indicator graphics (will be redrawn on resize)
    this.minimapCenterMarker = this.add.graphics();
    this.minimapContainer.add(this.minimapCenterMarker);
    this.drawMinimapCenterMarker();
    
    // Minimap label
    this.minimapLabel = this.add.text(
      this.minimapWidth / 2, -10,
      "Zemljevid (M za povečavo)",
      {
        fontSize: "11px",
        color: "#333",
        fontStyle: "bold",
        backgroundColor: "#ffffffdd",
        padding: { x: 6, y: 2 }
      }
    ).setOrigin(0.5);
    this.minimapContainer.add(this.minimapLabel);
    
    // Create legend container (shown when expanded)
    this.createMinimapLegend();
    
    // Create a separate interactive zone for minimap (not inside container for better input handling)
    this.minimapInteractiveZone = this.add.zone(
      this.minimapX, this.minimapY,
      this.minimapWidth, this.minimapHeight
    ).setOrigin(0).setScrollFactor(0).setDepth(951).setInteractive({ useHandCursor: true });
    
    // Track if we're dragging on minimap
    this.isDraggingMinimap = false;
    
    this.minimapInteractiveZone.on("pointerdown", (pointer) => {
      this.isDraggingMinimap = true;
      const localX = pointer.x - this.minimapX;
      const localY = pointer.y - this.minimapY;
      this.moveCameraFromMinimapLocal(localX, localY);
    });
    
    this.minimapInteractiveZone.on("pointermove", (pointer) => {
      if (this.isDraggingMinimap && pointer.isDown) {
        const localX = pointer.x - this.minimapX;
        const localY = pointer.y - this.minimapY;
        this.moveCameraFromMinimapLocal(localX, localY);
      }
    });
    
    this.minimapInteractiveZone.on("pointerup", () => {
      this.isDraggingMinimap = false;
    });
    
    // Scene-level handler for releasing outside minimap
    this.input.on("pointerup", () => {
      this.isDraggingMinimap = false;
    });
    
    // Toggle minimap size with M key
    this.input.keyboard.on("keydown-M", () => {
      this.toggleMinimapSize();
    });
  }

  /**
   * Move camera based on local minimap coordinates
   */
  moveCameraFromMinimapLocal(localX, localY) {
    // Clamp to minimap bounds
    const clampedX = Math.max(0, Math.min(localX, this.minimapWidth));
    const clampedY = Math.max(0, Math.min(localY, this.minimapHeight));
    
    // Convert minimap position to world position
    const worldX = clampedX / this.minimapScaleX;
    const worldY = clampedY / this.minimapScaleY;
    
    // Center camera on position
    const { width, height } = this.cameras.main;
    this.cameras.main.scrollX = worldX - width / 2;
    this.cameras.main.scrollY = worldY - height / 2;
  }

  /**
   * Create the legend for minimap colors
   */
  createMinimapLegend() {
    this.minimapLegendContainer = this.add.container(0, this.minimapHeight + 5);
    this.minimapLegendContainer.setVisible(false); // Hidden by default
    this.minimapContainer.add(this.minimapLegendContainer);
    
    // Legend background
    const legendWidth = this.minimapWidth;
    const legendHeight = 95;
    const legendBg = this.add.rectangle(0, 0, legendWidth, legendHeight, 0xffffff, 0.95).setOrigin(0);
    legendBg.setStrokeStyle(2, 0x4a3c2a);
    this.minimapLegendContainer.add(legendBg);
    
    // Legend title
    const legendTitle = this.add.text(legendWidth / 2, 8, "Legenda", {
      fontSize: "12px",
      color: "#333",
      fontStyle: "bold"
    }).setOrigin(0.5, 0);
    this.minimapLegendContainer.add(legendTitle);
    
    // Color mapping for component types
    const legendItems = [
      { color: 0xffcc00, label: "Baterija" },
      { color: 0xff6600, label: "Upor" },
      { color: 0xff4444, label: "Svetilka" },
      { color: 0x666666, label: "Stikalo" },
      { color: 0x0066cc, label: "Žica" },
      { color: 0x00cc66, label: "Ampermeter" },
      { color: 0x9900cc, label: "Voltmeter" }
    ];
    
    const startY = 26;
    const itemHeight = 10;
    const col1X = 10;
    const col2X = legendWidth / 2 + 5;
    
    legendItems.forEach((item, index) => {
      const col = index < 4 ? 0 : 1;
      const row = index < 4 ? index : index - 4;
      const x = col === 0 ? col1X : col2X;
      const y = startY + row * itemHeight;
      
      // Color dot
      const dot = this.add.circle(x + 5, y + 4, 4, item.color);
      this.minimapLegendContainer.add(dot);
      
      // Label
      const label = this.add.text(x + 14, y, item.label, {
        fontSize: "9px",
        color: "#333"
      });
      this.minimapLegendContainer.add(label);
    });
  }

  /**
   * Toggle minimap between small and large size
   */
  toggleMinimapSize() {
    const { width, height } = this.cameras.main;
    
    this.minimapExpanded = !this.minimapExpanded;
    
    if (this.minimapExpanded) {
      this.minimapWidth = this.minimapLargeWidth;
      this.minimapHeight = this.minimapLargeHeight;
    } else {
      this.minimapWidth = this.minimapSmallWidth;
      this.minimapHeight = this.minimapSmallHeight;
    }
    
    // Update position
    this.minimapX = width - this.minimapWidth - this.minimapPadding;
    this.minimapY = height - this.minimapHeight - this.minimapPadding - (this.minimapExpanded ? 100 : 0);
    this.minimapContainer.setPosition(this.minimapX, this.minimapY);
    
    // Update scale factors
    this.minimapScaleX = this.minimapWidth / this.canvasWidth;
    this.minimapScaleY = this.minimapHeight / this.canvasHeight;
    
    // Resize background
    this.minimapBg.setSize(this.minimapWidth, this.minimapHeight);
    
    // Update interactive zone position and size
    this.minimapInteractiveZone.setPosition(this.minimapX, this.minimapY);
    this.minimapInteractiveZone.setSize(this.minimapWidth, this.minimapHeight);
    this.minimapInteractiveZone.input.hitArea.setTo(0, 0, this.minimapWidth, this.minimapHeight);
    
    // Redraw grid
    this.drawMinimapGrid();
    
    // Redraw center marker
    this.drawMinimapCenterMarker();
    
    // Update label position and text
    this.minimapLabel.setPosition(this.minimapWidth / 2, -10);
    this.minimapLabel.setText(this.minimapExpanded ? "Zemljevid (M za pomanjšavo)" : "Zemljevid (M za povečavo)");
    
    // Update legend position and visibility
    this.minimapLegendContainer.setPosition(0, this.minimapHeight + 5);
    this.minimapLegendContainer.setVisible(this.minimapExpanded);
    
    // Update legend background width
    if (this.minimapLegendContainer.list[0]) {
      this.minimapLegendContainer.list[0].setSize(this.minimapWidth, 95);
    }
    // Update legend title position
    if (this.minimapLegendContainer.list[1]) {
      this.minimapLegendContainer.list[1].setPosition(this.minimapWidth / 2, 8);
    }
  }

  /**
   * Draw minimap grid lines
   */
  drawMinimapGrid() {
    this.minimapGrid.clear();
    this.minimapGrid.lineStyle(1, 0x8b7355, 0.3);
    const gridStep = this.minimapExpanded ? 25 : 20;
    for (let x = 0; x <= this.minimapWidth; x += gridStep) {
      this.minimapGrid.beginPath();
      this.minimapGrid.moveTo(x, 0);
      this.minimapGrid.lineTo(x, this.minimapHeight);
      this.minimapGrid.strokePath();
    }
    for (let y = 0; y <= this.minimapHeight; y += gridStep) {
      this.minimapGrid.beginPath();
      this.minimapGrid.moveTo(0, y);
      this.minimapGrid.lineTo(this.minimapWidth, y);
      this.minimapGrid.strokePath();
    }
  }

  /**
   * Draw center marker on minimap
   */
  drawMinimapCenterMarker() {
    this.minimapCenterMarker.clear();
    const centerX = (this.canvasWidth / 2) * this.minimapScaleX;
    const centerY = (this.canvasHeight / 2) * this.minimapScaleY;
    this.minimapCenterMarker.lineStyle(1, 0x666666, 0.5);
    this.minimapCenterMarker.beginPath();
    this.minimapCenterMarker.moveTo(centerX - 5, centerY);
    this.minimapCenterMarker.lineTo(centerX + 5, centerY);
    this.minimapCenterMarker.moveTo(centerX, centerY - 5);
    this.minimapCenterMarker.lineTo(centerX, centerY + 5);
    this.minimapCenterMarker.strokePath();
  }

  /**
   * Update the scrollable panel position and indicators
   */
  updatePanelScroll() {
    const { height } = this.cameras.main;
    const panelTop = 80; // Below the title and scroll up indicator
    const panelBottom = height - 20;
    
    // Update each panel component's position based on scroll
    if (this.panelComponentObjects) {
      const componentSpacing = 100;
      const componentStartY = 95;
      
      for (let i = 0; i < this.panelComponentObjects.length; i++) {
        const comp = this.panelComponentObjects[i];
        if (comp && comp.active) {
          const baseY = componentStartY + (i * componentSpacing);
          const newY = baseY - this.panelScrollY;
          comp.y = newY;
          
          // Hide components that are outside the visible panel area
          const isVisible = newY > panelTop && newY < panelBottom;
          comp.setVisible(isVisible);
          
          // Also update the label if it exists
          const label = comp.getData("panelLabel");
          if (label) {
            label.setVisible(isVisible);
          }
        }
      }
    }
    
    // Update scroll indicators
    if (this.scrollUpIndicator) {
      this.scrollUpIndicator.setAlpha(this.panelScrollY > 0 ? 0.8 : 0);
    }
    if (this.scrollDownIndicator) {
      this.scrollDownIndicator.setAlpha(this.panelScrollY < this.panelMaxScroll ? 0.8 : 0);
    }
  }

  /**
   * Update minimap to show current viewport and components
   */
  updateMinimap() {
    if (!this.minimapContainer || !this.minimapContainer.visible) return;
    
    const camera = this.cameras.main;
    const { width, height } = camera;
    
    // Update viewport indicator
    this.minimapViewport.clear();
    this.minimapViewport.lineStyle(2, 0x3399ff, 1);
    this.minimapViewport.fillStyle(0x3399ff, 0.2);
    
    const vpX = camera.scrollX * this.minimapScaleX;
    const vpY = camera.scrollY * this.minimapScaleY;
    const vpW = width * this.minimapScaleX;
    const vpH = height * this.minimapScaleY;
    
    this.minimapViewport.fillRect(vpX, vpY, vpW, vpH);
    this.minimapViewport.strokeRect(vpX, vpY, vpW, vpH);
    
    // Update component dots
    this.minimapComponentsGraphics.clear();
    
    // Color mapping for component types
    const colorMap = {
      battery: 0xffcc00,
      resistor: 0xff6600,
      bulb: 0xff4444,
      switch: 0x666666,
      wire: 0x0066cc,
      ammeter: 0x00cc66,
      voltmeter: 0x9900cc
    };
    
    const dotSize = this.minimapExpanded ? 5 : 4;
    
    for (const component of this.placedComponents) {
      if (component.getData("isInPanel")) continue;
      
      const logicComp = component.getData("logicComponent");
      const type = logicComp?.type || "wire";
      const color = colorMap[type] || 0xffffff;
      
      const dotX = component.x * this.minimapScaleX;
      const dotY = component.y * this.minimapScaleY;
      
      // Draw colored dot with white outline for visibility
      this.minimapComponentsGraphics.lineStyle(1, 0xffffff, 0.8);
      this.minimapComponentsGraphics.fillStyle(color, 1);
      this.minimapComponentsGraphics.fillCircle(dotX, dotY, dotSize);
      this.minimapComponentsGraphics.strokeCircle(dotX, dotY, dotSize);
    }
  }

  /**
   * Jump camera to the nearest placed component from current view center
   */
  jumpToNearestComponent() {
    // Filter only workbench components (not panel components)
    const workbenchComponents = this.placedComponents.filter(
      comp => !comp.getData("isInPanel")
    );
    
    if (workbenchComponents.length === 0) {
      // No components placed - show message
      this.showJumpFeedback("Ni komponent na mizi!", 0xff6666);
      return;
    }
    
    const camera = this.cameras.main;
    const { width, height } = camera;
    
    // Current center of the viewport in world coordinates
    const viewCenterX = camera.scrollX + width / 2;
    const viewCenterY = camera.scrollY + height / 2;
    
    // Find the nearest component
    let nearestComponent = null;
    let nearestDistance = Infinity;
    
    for (const component of workbenchComponents) {
      const dx = component.x - viewCenterX;
      const dy = component.y - viewCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Skip components that are already very close to center (within 50px)
      if (distance < 50) continue;
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestComponent = component;
      }
    }
    
    // If all components are already centered, find any component
    if (!nearestComponent && workbenchComponents.length > 0) {
      nearestComponent = workbenchComponents[0];
    }
    
    if (nearestComponent) {
      // Animate camera to the component
      const targetScrollX = nearestComponent.x - width / 2;
      const targetScrollY = nearestComponent.y - height / 2;
      
      this.tweens.add({
        targets: camera,
        scrollX: targetScrollX,
        scrollY: targetScrollY,
        duration: 300,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          // Flash the component to highlight it
          this.highlightComponent(nearestComponent);
        }
      });
      
      // Show component type
      const logicComp = nearestComponent.getData("logicComponent");
      const typeNames = {
        battery: "Baterija",
        resistor: "Upor",
        bulb: "Svetilka",
        switch: "Stikalo",
        wire: "Žica",
        ammeter: "Ampermeter",
        voltmeter: "Voltmeter",
        led: "LED",
        fuse: "Varovalka"
      };
      const typeName = typeNames[logicComp?.type] || "Komponenta";
      this.showJumpFeedback(`→ ${typeName}`, 0x3399ff);
    }
  }

  /**
   * Highlight a component with a brief flash effect
   */
  highlightComponent(component) {
    if (!component) return;
    
    // Create a highlight circle around the component
    const highlight = this.add.circle(component.x, component.y, 60, 0x3399ff, 0.3);
    highlight.setDepth(100);
    
    this.tweens.add({
      targets: highlight,
      alpha: 0,
      scale: 1.5,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        highlight.destroy();
      }
    });
  }

  /**
   * Show feedback text when jumping to component
   */
  showJumpFeedback(message, color) {
    const { width } = this.cameras.main;
    
    const feedback = this.add.text(width / 2, 100, message, {
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: `#${color.toString(16).padStart(6, '0')}`,
      padding: { x: 15, y: 8 }
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(1000);
    
    this.tweens.add({
      targets: feedback,
      alpha: 0,
      y: 80,
      duration: 1000,
      delay: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        feedback.destroy();
      }
    });
  }

  setupCameraDragging() {
    let isDraggingCamera = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let cameraStartX = 0;
    let cameraStartY = 0;

    this.input.on("pointerdown", (pointer) => {
      // Only drag camera with middle mouse button
      if (pointer.middleButtonDown()) {
        isDraggingCamera = true;
        dragStartX = pointer.x;
        dragStartY = pointer.y;
        cameraStartX = this.cameras.main.scrollX;
        cameraStartY = this.cameras.main.scrollY;
        this.input.setDefaultCursor('grab');
      }
    });

    this.input.on("pointermove", (pointer) => {
      if (isDraggingCamera) {
        const deltaX = dragStartX - pointer.x;
        const deltaY = dragStartY - pointer.y;
        this.cameras.main.scrollX = cameraStartX + deltaX;
        this.cameras.main.scrollY = cameraStartY + deltaY;
      }
    });

    this.input.on("pointerup", (pointer) => {
      if (isDraggingCamera) {
        isDraggingCamera = false;
        this.input.setDefaultCursor('default');
      }
    });

    // Disable mouse wheel scrolling/zooming
    this.input.on("wheel", (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      // Mouse wheel disabled - do nothing
      return;
    });
  }

  handleResize(gameSize) {
    // Clear any pending resize timer
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }

    // Wait for resize to finish (user stops dragging) before repositioning
    this.resizeTimer = setTimeout(() => {
      this.doResize(gameSize);
    }, 250); // Wait 250ms after last resize event
  }

  doResize(gameSize) {
    // Only resize if scene is still active
    if (!this.scene.isActive()) {
      return;
    }

    try {
      const { width, height } = gameSize;
      
      // Resize left panel height
      if (this.leftPanel) {
        this.leftPanel.setDisplaySize(this.panelWidth, height);
      }
      if (this.leftPanelOverlay) {
        this.leftPanelOverlay.setDisplaySize(this.panelWidth, height);
      }
      
      // Update scroll indicators position and recalculate max scroll
      if (this.scrollDownIndicator) {
        this.scrollDownIndicator.setPosition(this.panelWidth / 2, height - 15);
      }
      const componentSpacing = 100;
      const componentStartY = 95;
      const numComponents = 9;
      const totalContentHeight = componentStartY + (numComponents * componentSpacing);
      this.panelMaxScroll = Math.max(0, totalContentHeight - height + 50);
      this.panelScrollY = Phaser.Math.Clamp(this.panelScrollY, this.panelMinScroll, this.panelMaxScroll);
      this.updatePanelScroll();
      
      // Reposition prompt text (challenge mode)
      if (this.promptText) {
        this.promptText.setPosition(width / 1.8, height - 30);
      }
      
      // Reposition check text
      if (this.checkText) {
        this.checkText.setPosition(width / 2, this.mode === 'sandbox' ? 70 : height - 70);
      }
      
      // Reposition missing text (challenge mode)
      if (this.missingText) {
        this.missingText.setPosition(width / 2, height - 100);
      }
      
      // Reposition title text
      if (this.titleText) {
        this.titleText.setPosition(width / 2 + 50, 30);
      }
      
      // Reposition UI buttons (top right)
      if (this.uiButtons) {
        const buttonWidth = 180;
        const buttonHeight = 45;
        const cornerRadius = 10;
        
        for (const button of this.uiButtons) {
          const newX = width - button.xOffset;
          button.text.setPosition(newX, button.y);
          button.bg.clear();
          button.bg.fillStyle(0x3399ff, 1);
          button.bg.fillRoundedRect(
            newX - buttonWidth / 2,
            button.y - buttonHeight / 2,
            buttonWidth,
            buttonHeight,
            cornerRadius
          );
        }
      }
      
      // Reposition minimap (bottom right)
      if (this.minimapContainer) {
        this.minimapX = width - this.minimapWidth - this.minimapPadding;
        this.minimapY = height - this.minimapHeight - this.minimapPadding - (this.minimapExpanded ? 100 : 0);
        this.minimapContainer.setPosition(this.minimapX, this.minimapY);
        
        // Also update the interactive zone position
        if (this.minimapInteractiveZone) {
          this.minimapInteractiveZone.setPosition(this.minimapX, this.minimapY);
        }
      }
    } catch (error) {
      console.error('Error during resize:', error);
    }
  }
}
