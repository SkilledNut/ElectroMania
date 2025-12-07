import Phaser from "phaser";
import LabScene from "./labScene";
import { Battery } from "../components/battery";
import { Bulb } from "../components/bulb";
import { Wire } from "../components/wire";
import { CircuitGraph } from "../logic/circuit_graph";
import { Node } from "../logic/node";
import { Switch } from "../components/switch";
import { Resistor } from "../components/resistor";
import { Ammeter } from "../components/ammeter";
import { Voltmeter } from "../components/voltmeter";

export default class WorkspaceScene extends Phaser.Scene {
  constructor() {
    super("WorkspaceScene");
  }

  init(data) {
    // Mode can be 'challenge' or 'sandbox'
    this.mode = data?.mode || 'challenge';
    
    if (this.mode === 'challenge') {
      const savedIndex = localStorage.getItem("currentChallengeIndex");
      this.currentChallengeIndex = savedIndex !== null ? parseInt(savedIndex) : 0;
    }

    // Infinite canvas settings for both modes
    this.canvasWidth = 10000;
    this.canvasHeight = 10000;
  }

  preload() {
    this.graph = new CircuitGraph();
    this.load.image("baterija", "src/components/battery.png");
    this.load.image("upor", "src/components/resistor.png");
    this.load.image("svetilka", "src/components/lamp.png");
    this.load.image("stikalo-on", "src/components/switch-on.png");
    this.load.image("stikalo-off", "src/components/switch-off.png");
    this.load.image("žica", "src/components/wire.png");
    this.load.image("ampermeter", "src/components/ammeter.png");
    this.load.image("voltmeter", "src/components/voltmeter.png");
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

    this.challenges = [
      {
        prompt: "Sestavi preprosti električni krog z baterijo in svetilko.",
        requiredComponents: [
          "baterija",
          "svetilka",
          "žica",
          "žica",
          "žica",
          "žica",
          "žica",
          "žica",
        ],
        theory: [
          "Osnovni električni krog potrebuje vir, to je v našem primeru baterija. Potrebuje tudi porabnike, to je svetilka. Električni krog je v našem primeru sklenjen, kar je nujno potrebno, da električni tok teče preko prevodnikov oziroma žic.",
        ],
      },
      {
        prompt:
          "Sestavi preprosti nesklenjeni električni krog z baterijo, svetilko in stikalom.",
        requiredComponents: ["baterija", "svetilka", "žica", "stikalo"],
        theory: [
          "V nesklenjenem krogu je stikalo odprto, kar pomeni, da je električni tok prekinjen. Svetilka posledično zato ne sveti.",
        ],
      },
      {
        prompt:
          "Sestavi preprosti sklenjeni električni krog z baterijo, svetilko in stikalom.",
        requiredComponents: ["baterija", "svetilka", "žica", "stikalo"],
        theory: [
          "V sklenjenem krogu je stikalo zaprto, kar pomeni, da lahko električni tok teče neovirano. Torej v tem primeru so vrata zaprta.",
        ],
      },
      {
        prompt:
          "Sestavi električni krog z baterijo, svetilko in stikalom, ki ga lahko ugašaš in prižigaš.",
        requiredComponents: [
          "baterija",
          "svetilka",
          "žica",
          "stikalo",
        ],
        theory: [
          "Stikalo nam omogoča nadzor nad pretokom električnega toka. Ko je stikalo zaprto, tok teče in posledično svetilka sveti. Kadar pa je stikalo odprto, tok ne teče in se svetilka ugasne. To lahko primerjamo z vklapljanjem in izklapljanjem električnih naprav v naših domovih.",
        ],
      },
      {
        prompt: "Sestavi krog z dvema baterijama in svetilko. ",
        requiredComponents: ["baterija", "baterija", "svetilka", "žica"],
        theory: [
          "Kadar vežemo dve ali več baterij zaporedno, se napetosti seštevajo. Večja je napetost, večji je električni tok. V našem primeru zato svetilka sveti močneje.",
        ],
      },
      {
        prompt:
          "V električni krog zaporedno poveži dve svetilki, ki ju priključiš na baterijo. ",
        requiredComponents: ["baterija", "svetilka", "svetilka", "žica"],
        theory: [
          "V zaporedni vezavi teče isti električni tok skozi vse svetilke. Napetost baterije se porazdeli. Če imamo primer, da ena svetilka preneha delovati, bo ta prekinila tok skozi drugo svetilko.",
        ],
      },

      {
        prompt:
          "V električni krog vzporedno poveži dve svetilki, ki ju priključiš na baterijo. ",
        requiredComponents: ["baterija", "svetilka", "svetilka", "žica"],
        theory: [
          "V vzporedni vezavi ima vsaka svetilka enako napetost kot baterija. Eletrični tok se porazdeli med svetilkami. Če ena svetilka preneha delovati, bo druga še vedno delovala.",
        ],
      },
      {
        prompt: "Sestavi električni krog s svetilko in uporom. ",
        requiredComponents: ["baterija", "svetilka", "žica", "upor"],
        theory: [
          "Upor omejuje tok v krogu. Večji kot je upor, manjši je tok. Spoznajmo Ohmov zakon: tok (I) = napetost (U) / upornost (R). Svetilka bo svetila manj intenzivno, saj skozi njo teče manjši tok.",
        ],
      },
    ];

    // this.currentChallengeIndex = 0;

    // Create mode-specific UI elements
    if (this.mode === 'challenge') {
      this.promptText = this.add
        .text(
          width / 1.8,
          height - 30,
          this.challenges[this.currentChallengeIndex].prompt,
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

    const makeButton = (x, y, label, onClick) => {
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

      const text = this.add
        .text(x, y, label, {
          fontFamily: "Arial",
          fontSize: "20px",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => {
          bg.clear();
          bg.fillStyle(0x0f5cad, 1);
          bg.fillRoundedRect(
            x - buttonWidth / 2,
            y - buttonHeight / 2,
            buttonWidth,
            buttonHeight,
            cornerRadius
          );
        })
        .on("pointerout", () => {
          bg.clear();
          bg.fillStyle(0x3399ff, 1);
          bg.fillRoundedRect(
            x - buttonWidth / 2,
            y - buttonHeight / 2,
            buttonWidth,
            buttonHeight,
            cornerRadius
          );
        })
        .on("pointerdown", onClick);

      return { bg, text };
    };

    // Mode-specific buttons - store references for resize
    this.uiButtons = [];
    if (this.mode === 'challenge') {
      this.uiButtons.push(makeButton(width - 140, 75, "Lestvica", () =>
        this.scene.start("ScoreboardScene", { cameFromMenu: false })
      ));
      this.uiButtons.push(makeButton(width - 140, 125, "Preveri krog", () => this.checkCircuit()));
    } else {
      // Sandbox mode buttons
      this.uiButtons.push(makeButton(width - 140, 30, "Shrani", () => this.saveSandbox()));
      this.uiButtons.push(makeButton(width - 140, 80, "Naloži", () => this.loadSandbox()));
      this.uiButtons.push(makeButton(width - 140, 130, "Počisti", () => this.clearSandbox()));
      this.uiButtons.push(makeButton(width - 140, 180, "Simuliraj", () => {
        const result = this.graph.simulate();
        this.updateCircuitStatusLabel(result.status);
        this.visualizeElectricity(result.paths);
      }));
    }

    // stranska vrstica na levi
    this.panelWidth = 150;
    this.leftPanel = this.add.rectangle(0, 0, this.panelWidth, height, 0xc0c0c0).setOrigin(0).setScrollFactor(0).setDepth(800);
    this.leftPanelOverlay = this.add.rectangle(0, 0, this.panelWidth, height, 0x000000, 0.2).setOrigin(0).setScrollFactor(0).setDepth(801);

    this.componentsPanelTitle = this.add
      .text(this.panelWidth / 2, 60, "Komponente", {
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(802);

    // komponente v stranski vrstici (these stay at fixed positions)
    this.createComponent(this.panelWidth / 2, 100, "baterija", 0xffcc00, true);
    this.createComponent(this.panelWidth / 2, 180, "upor", 0xff6600, true);
    this.createComponent(this.panelWidth / 2, 260, "svetilka", 0xff0000, true);
    this.createComponent(this.panelWidth / 2, 340, "stikalo", 0x666666, true);
    this.createComponent(this.panelWidth / 2, 420, "žica", 0x0066cc, true);
    this.createComponent(this.panelWidth / 2, 500, "ampermeter", 0x00cc66, true);
    this.createComponent(this.panelWidth / 2, 580, "voltmeter", 0x00cc66, true);

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

    // Note: Don't auto-load sandbox on entry - let user choose to load with button
    // This prevents black screen issues when camera was saved in an empty area

    // Setup keyboard input for rotation
    this.input.keyboard.on("keydown-R", () => {
      // Find the component under the pointer
      const pointer = this.input.activePointer;
      const worldX = pointer.worldX;
      const worldY = pointer.worldY;

      // Check which component is under the pointer
      for (const component of this.placedComponents) {
        if (component.getData("isInPanel")) continue;

        const bounds = component.getBounds();
        if (bounds.contains(worldX, worldY)) {
          const logicComp = component.getData("logicComponent");

          // Don't rotate switches, they should only toggle
          if (logicComp && logicComp.type === "switch") continue;

          // Rotate the component
          const currentRotation = component.getData("rotation");
          const newRotation = (currentRotation + 90) % 360;
          component.setData("rotation", newRotation);
          component.setData("isRotated", !component.getData("isRotated"));

          this.tweens.add({
            targets: component,
            angle: newRotation === 270 ? -90 : newRotation,
            duration: 150,
            ease: "Cubic.easeOut",
            onComplete: () => {
              this.rebuildGraph();
            },
          });

          break; // Only rotate the first component found
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

    console.log(JSON.parse(localStorage.getItem("users")));
  }

  getComponentDetails(type) {
    const details = {
      baterija: "Napetost: 3.3 V\nVir električne energije",
      upor: "Uporabnost: omejuje tok\nMeri se v ohmih (Ω)",
      svetilka: "Pretvarja električno energijo v svetlobo",
      stikalo: "Stikalo: omogoča vklop/izklop pretoka toka",
      žica: "Povezuje komponente\nKlikni za obračanje",
      ampermeter: "Meri električni tok\nEnota: amperi (A)\nPoveži zaporedno!",
      voltmeter: "Meri električno napetost\nEnota: volti (V)\nPoveži vzporedno!",
    };
    return details[type] || "Komponenta";
  }

  getMissingComponents() {
    const currentChallenge = this.challenges[this.currentChallengeIndex];
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

    console.log(
      "[Scene] Rebuilt graph with",
      this.graph.components.length,
      "components"
    );

    // Auto-simulate and update label after rebuild
    const result = this.graph.simulate();
    this.updateCircuitStatusLabel(result.status);
    this.updateMissingComponentsLabel();
    this.visualizeElectricity(result.paths);
    this.updateMeterDisplays();
  }

  /**
   * Update the visual displays on ammeters and voltmeters
   */
  updateMeterDisplays() {
    for (const component of this.placedComponents) {
      const comp = component.getData("logicComponent");
      const measurementText = component.getData("measurementText");
      
      if (!comp || !measurementText) continue;

      if (comp.type === "ammeter") {
        const current = comp.current || 0;
        measurementText.setText(`${current.toFixed(2)} A`);
      } else if (comp.type === "voltmeter") {
        const voltage = comp.voltage || 0;
        measurementText.setText(`${voltage.toFixed(2)} V`);
      }
    }
  }

  /**
   * Update the label showing missing components for current challenge
   */
  updateMissingComponentsLabel() {
    if (
      !this.missingText ||
      !this.challenges ||
      this.currentChallengeIndex === undefined
    )
      return;

    const currentChallenge = this.challenges[this.currentChallengeIndex];
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
   * Visualize electricity flow along circuit paths
   */
  visualizeElectricity(paths) {
    if (this.electricityTimers && this.electricityTimers.length > 0) {
      for (const t of this.electricityTimers) {
        if (!t) continue;
        if (typeof t.remove === "function") {
          try { t.remove(false); } catch (e) { if (typeof t.destroy === "function") t.destroy(); }
        } else if (typeof t.destroy === "function") {
          t.destroy();
        }
      }
      this.electricityTimers = [];
    }

    if (this.electricityParticles && this.electricityParticles.length > 0) {
      for (const p of this.electricityParticles) {
        if (p.tween) p.tween.remove();
        p.destroy();
      }
    }
    this.electricityParticles = [];
    if (this.electricityGraphics) this.electricityGraphics.clear();

    if (!paths || paths.length === 0) {
      return;
    }

    console.log(
      "[Electricity] Visualizing flow through",
      paths.length,
      "path(s)"
    );

    const PARTICLE_COUNT_PER_PATH = 4;
    const PARTICLE_SPEED = 4000;

    for (let pathIndex = 0; pathIndex < paths.length; pathIndex++) {
      const path = paths[pathIndex];
      if (!path || path.length === 0) continue;

      for (let i = 0; i < PARTICLE_COUNT_PER_PATH; i++) {
        const delay = i * (PARTICLE_SPEED / PARTICLE_COUNT_PER_PATH);
        const timer = this.time.delayedCall(delay, () => {
          this.createElectricityParticle(path);
        });
        this.electricityTimers.push(timer);
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

    // swap logic components
    const draggedLogic = draggedComponent.getData("logicComponent");
    const targetLogic = targetComponent.getData("logicComponent");

    draggedComponent.setData("logicComponent", targetLogic);
    targetComponent.setData("logicComponent", draggedLogic);

    // Rebuild graph after swap
    this.rebuildGraph();
  }

  createComponent(x, y, type, color, isInPanel = false) {
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
        
        // Add voltage label
        const voltageLabel = this.add
          .text(0, 45, "3.3V", {
            fontSize: "12px",
            color: "#000000",
            fontStyle: "bold",
            backgroundColor: "#ffcc00cc",
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0.5)
          .setVisible(!isInPanel);
        component.add(voltageLabel);
        component.setData("valueLabel", voltageLabel);
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
        
        // Add resistance label
        const resistanceLabel = this.add
          .text(0, 45, "1.5Ω", {
            fontSize: "12px",
            color: "#000000",
            fontStyle: "bold",
            backgroundColor: "#ff6600cc",
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0.5)
          .setVisible(!isInPanel);
        component.add(resistanceLabel);
        component.setData("valueLabel", resistanceLabel);
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
        break;

      case "stikalo":
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
        component.add(componentImage);
        component.setData("logicComponent", comp);
        break;
      case "ampermeter":
        id = "ammeter_" + this.getRandomInt(1000, 9999);
        comp = new Ammeter(
          id,
          new Node(id + "_start", -40, 0),
          new Node(id + "_end", 40, 0)
        );
        comp.type = "ammeter";
        comp.current = 0;
        comp.localStart = { x: -40, y: 0 };
        comp.localEnd = { x: 40, y: 0 };
        componentImage = this.add
          .image(0, 0, "ampermeter")
          .setOrigin(0.5)
          .setDisplaySize(100, 100);
        component.add(componentImage);
        
        // Add text display for current reading (hidden in panel)
        const ammeterText = this.add
          .text(0, -45, "0.00 A", {
            fontSize: "14px",
            color: "#000000",
            fontStyle: "bold",
            backgroundColor: "#ffffffcc",
            padding: { x: 5, y: 2 },
          })
          .setOrigin(0.5)
          .setVisible(!isInPanel); // Hide if in panel
        component.add(ammeterText);
        component.setData("measurementText", ammeterText);
        component.setData("logicComponent", comp);
        break;
      case "voltmeter":
        id = "voltmeter_" + this.getRandomInt(1000, 9999);
        comp = new Voltmeter(
          id,
          new Node(id + "_start", -40, 0),
          new Node(id + "_end", 40, 0)
        );
        comp.type = "voltmeter";
        comp.voltage = 0;
        comp.localStart = { x: -40, y: 0 };
        comp.localEnd = { x: 40, y: 0 };
        componentImage = this.add
          .image(0, 0, "voltmeter")
          .setOrigin(0.5)
          .setDisplaySize(100, 100);
        component.add(componentImage);
        
        // Add text display for voltage reading (hidden in panel)
        const voltmeterText = this.add
          .text(0, -45, "0.00 V", {
            fontSize: "14px",
            color: "#000000",
            fontStyle: "bold",
            backgroundColor: "#ffffffcc",
            padding: { x: 5, y: 2 },
          })
          .setOrigin(0.5)
          .setVisible(!isInPanel); // Hide if in panel
        component.add(voltmeterText);
        component.setData("measurementText", voltmeterText);
        component.setData("logicComponent", comp);
        break;
    }

    component.on("pointerover", () => {
      if (component.getData("isInPanel")) {
        // prikaži info okno
        const details = this.getComponentDetails(type);
        this.infoText.setText(details);

        // zraven komponente
        this.infoWindow.x = x + 120;
        this.infoWindow.y = y;
        this.infoWindow.setVisible(true);
      }
      component.setScale(1.1);
    });

    component.on("pointerout", () => {
      if (component.getData("isInPanel")) {
        this.infoWindow.setVisible(false);
      }
      component.setScale(1);
    });

    // Label - only show in panel
    if (isInPanel) {
      const label = this.add
        .text(0, 30, type, {
          fontSize: "11px",
          color: "#fff",
          backgroundColor: "#00000088",
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5);
      component.add(label);
      component.setData("label", label);
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
    component.setData("isDragging", false);

    // Set scroll factor and depth based on panel status
    if (isInPanel) {
      component.setScrollFactor(0);
      component.setDepth(850);
    }

    this.input.setDraggable(component);

    component.on("dragstart", () => {
      component.setData("isDragging", true);
      component.setData("dragStartX", component.x);
      component.setData("dragStartY", component.y);
      component.setData("hasSwapped", false);
    });

    component.on("drag", (pointer, dragX, dragY) => {
      if (component.getData("isInPanel")) {
        component.x = dragX;
        component.y = dragY;
      } else {
        // For components on canvas, use world coordinates
        component.x = pointer.worldX;
        component.y = pointer.worldY;
      }
    });

    component.on("dragend", (pointer) => {
      const isInPanel = pointer.x < 200;
      const wasInPanel = component.getData("isInPanel");
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
        // s strani na mizo
        const snapped = this.snapToGrid(pointer.worldX, pointer.worldY);
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
        component.setScrollFactor(1);
        component.setDepth(100);
        
        // Hide label when moving from panel to workspace
        const label = component.getData("label");
        if (label) {
          label.setVisible(false);
        }
        
        // Show measurement text for meters when moving to workspace
        const measurementText = component.getData("measurementText");
        if (measurementText) {
          measurementText.setVisible(true);
        }
        
        // Show value labels for batteries and resistors when moving to workspace
        const valueLabel = component.getData("valueLabel");
        if (valueLabel) {
          valueLabel.setVisible(true);
        }
        
        this.placedComponents.push(component);
        
        const lbl = component.getData("labelObject");
        if (lbl) lbl.setVisible(false);

        this.createComponent(
          component.getData("originalX"),
          component.getData("originalY"),
          component.getData("type"),
          component.getData("color"),
          true
        );

        this.rebuildGraph();
      } else if (!wasInPanel) {
        // on the workbench - check for overlap and swap if detected
        const snapped = this.snapToGrid(pointer.worldX, pointer.worldY);
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
    // Track last click time for double-click detection
    component.setData("lastClickTime", 0);

    component.on("pointerup", (pointer) => {
      if (component.getData("isInPanel")) return;

      // Determine click duration and movement to distinguish short click
      const clickDuration =
        (pointer.upTime || this.time.now) - (pointer.downTime || 0);
      const dx = (pointer.downX || 0) - (pointer.x || 0);
      const dy = (pointer.downY || 0) - (pointer.y || 0);
      const moved = Math.sqrt(dx * dx + dy * dy);

      const CLICK_MS_THRESHOLD = 300; // ms
      const MOVE_PX_THRESHOLD = 10; // px
      const DOUBLE_CLICK_THRESHOLD = 400; // ms for double-click

      if (clickDuration <= CLICK_MS_THRESHOLD && moved <= MOVE_PX_THRESHOLD) {
        const logicComp = component.getData("logicComponent");
        const currentTime = this.time.now;
        const lastClickTime = component.getData("lastClickTime");
        const timeSinceLastClick = currentTime - lastClickTime;

        // Double-click detection for battery and resistor
        if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD && 
            logicComp && (logicComp.type === "battery" || logicComp.type === "resistor")) {
          this.showPropertyEditor(component, logicComp);
          component.setData("lastClickTime", 0); // Reset to prevent triple-click
          return;
        }

        component.setData("lastClickTime", currentTime);

        // Handle switch toggle on single click
        if (logicComp && logicComp.type === "switch") {
          logicComp.is_on = !logicComp.is_on;

          // Update visual
          const componentImage = component.list[0];
          if (componentImage) {
            componentImage.setTexture(
              logicComp.is_on ? "stikalo-on" : "stikalo-off"
            );
          }

          console.log(
            `[Switch] ${logicComp.id} toggled to ${
              logicComp.is_on ? "ON" : "OFF"
            }`
          );
          this.rebuildGraph();
        }
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

  showPropertyEditor(component, logicComp) {
    const { width, height } = this.cameras.main;
    
    // Create semi-transparent background
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2000)
      .setInteractive();
    
    // Create dialog box (made wider)
    const dialogWidth = 400;
    const dialogHeight = 220;
    const dialog = this.add.rectangle(width / 2, height / 2, dialogWidth, dialogHeight, 0xffffff, 1)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001)
      .setInteractive(); // Make dialog interactive to stop click propagation
    dialog.setStrokeStyle(3, 0x3399ff);
    
    // Stop propagation of clicks on dialog to prevent overlay from closing
    dialog.on('pointerdown', (pointer) => {
      pointer.event.stopPropagation();
    });
    
    // Title
    const title = logicComp.type === "battery" ? "Nastavi napetost" : "Nastavi upornost";
    const titleText = this.add.text(width / 2, height / 2 - 70, title, {
      fontSize: "20px",
      color: "#000000",
      fontStyle: "bold",
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2002);
    
    // Current value display
    const currentValue = logicComp.type === "battery" ? logicComp.voltage : logicComp.ohm;
    const unit = logicComp.type === "battery" ? "V" : "Ω";
    
    const valueText = this.add.text(width / 2, height / 2 - 30, `Trenutna vrednost: ${currentValue}${unit}`, {
      fontSize: "16px",
      color: "#333333",
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2002);
    
    // Input instruction
    const instructionText = this.add.text(width / 2, height / 2 + 5, `Vnesi novo vrednost (${unit}):`, {
      fontSize: "14px",
      color: "#666666",
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2002);
    
    // Create HTML input element
    const inputElement = document.createElement('input');
    inputElement.type = 'number';
    inputElement.step = logicComp.type === "battery" ? '0.1' : '0.5';
    inputElement.min = '0.1';
    inputElement.max = logicComp.type === "battery" ? '12' : '100';
    inputElement.value = currentValue;
    inputElement.style.position = 'absolute';
    inputElement.style.left = '50%';
    inputElement.style.top = '50%';
    inputElement.style.transform = 'translate(-50%, -50%)';
    inputElement.style.width = '200px';
    inputElement.style.padding = '10px';
    inputElement.style.fontSize = '18px';
    inputElement.style.border = '2px solid #3399ff';
    inputElement.style.borderRadius = '5px';
    inputElement.style.textAlign = 'center';
    inputElement.style.zIndex = '3000';
    document.body.appendChild(inputElement);
    inputElement.focus();
    inputElement.select();
    
    // Prevent clicks on input from closing dialog
    inputElement.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    inputElement.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    // OK Button
    const okButton = this.add.rectangle(width / 2 - 60, height / 2 + 70, 100, 40, 0x3399ff)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2002)
      .setInteractive({ useHandCursor: true });
    
    const okText = this.add.text(width / 2 - 60, height / 2 + 70, "Potrdi", {
      fontSize: "16px",
      color: "#ffffff",
      fontStyle: "bold",
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2003);
    
    // Cancel Button
    const cancelButton = this.add.rectangle(width / 2 + 60, height / 2 + 70, 100, 40, 0xcc0000)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2002)
      .setInteractive({ useHandCursor: true });
    
    const cancelText = this.add.text(width / 2 + 60, height / 2 + 70, "Prekliči", {
      fontSize: "16px",
      color: "#ffffff",
      fontStyle: "bold",
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2003);
    
    const closeDialog = () => {
      overlay.destroy();
      dialog.destroy();
      titleText.destroy();
      valueText.destroy();
      instructionText.destroy();
      okButton.destroy();
      okText.destroy();
      cancelButton.destroy();
      cancelText.destroy();
      inputElement.remove();
    };
    
    okButton.on('pointerdown', () => {
      const newValue = parseFloat(inputElement.value);
      if (!isNaN(newValue) && newValue > 0) {
        if (logicComp.type === "battery") {
          logicComp.voltage = newValue;
          const label = component.getData("valueLabel");
          if (label) label.setText(`${newValue.toFixed(1)}V`);
        } else {
          logicComp.ohm = newValue;
          const label = component.getData("valueLabel");
          if (label) label.setText(`${newValue.toFixed(1)}Ω`);
        }
        this.rebuildGraph();
      }
      closeDialog();
    });
    
    cancelButton.on('pointerdown', closeDialog);
    overlay.on('pointerdown', closeDialog);
    
    // Enter key to submit
    inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        okButton.emit('pointerdown');
      } else if (e.key === 'Escape') {
        closeDialog();
      }
    });
  }

  checkCircuit() {
    const currentChallenge = this.challenges[this.currentChallengeIndex];
    const placedTypes = this.placedComponents.map((comp) =>
      comp.getData("type")
    );
    console.log("components", placedTypes);
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

    if (currentChallenge.theory) {
      this.showTheory(currentChallenge.theory);
    } else {
      this.checkText.setStyle({ color: "#00aa00" });
      this.checkText.setText("Čestitke! Krog je pravilen.");
      this.addPoints(10);
      this.time.delayedCall(2000, () => this.nextChallenge());
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

  nextChallenge() {
    this.currentChallengeIndex++;
    localStorage.setItem(
      "currentChallengeIndex",
      this.currentChallengeIndex.toString()
    );
    this.checkText.setText("");

    if (this.currentChallengeIndex < this.challenges.length) {
      this.promptText.setText(
        this.challenges[this.currentChallengeIndex].prompt
      );
      this.updateMissingLabel();
    } else {
      this.promptText.setText("Vse naloge so uspešno opravljene! Čestitke!");
      this.missingText.setText("");
      localStorage.removeItem("currentChallengeIndex");
    }
  }

  addPoints(points) {
    const user = localStorage.getItem("username");
    const users = JSON.parse(localStorage.getItem("users")) || [];
    const userData = users.find((u) => u.username === user);
    if (userData) {
      userData.score = (userData.score || 0) + points;
    }
    localStorage.setItem("users", JSON.stringify(users));
  }

  showTheory(theoryText) {
    const { width, height } = this.cameras.main;

    this.theoryBack = this.add
      .rectangle(width / 2, height / 2, width - 100, 150, 0x000000, 0.8)
      .setOrigin(0.5)
      .setDepth(10);

    this.theoryText = this.add
      .text(width / 2, height / 2, theoryText, {
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: width - 150 },
      })
      .setOrigin(0.5)
      .setDepth(11);

    this.continueButton = this.add
      .text(width / 2, height / 2 + 70, "Nadaljuj", {
        fontSize: "18px",
        color: "#0066ff",
        backgroundColor: "#ffffff",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(11)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () =>
        this.continueButton.setStyle({ color: "#0044cc" })
      )
      .on("pointerout", () =>
        this.continueButton.setStyle({ color: "#0066ff" })
      )
      .on("pointerdown", () => {
        this.addPoints(10);
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

    // Zoom with mouse wheel
    this.input.on("wheel", (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      const zoomAmount = deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Phaser.Math.Clamp(
        this.cameras.main.zoom + zoomAmount,
        0.5,
        2
      );
      this.cameras.main.setZoom(newZoom);
    });
  }

  saveSandbox() {
    const saveData = {
      components: this.placedComponents.map((comp) => ({
        x: comp.x,
        y: comp.y,
        type: comp.getData("type"),
        rotation: comp.getData("rotation"),
        angle: comp.angle,
        logicComponent: comp.getData("logicComponent")
          ? {
              id: comp.getData("logicComponent").id,
              type: comp.getData("logicComponent").type,
              is_on: comp.getData("logicComponent").is_on,
            }
          : null,
      })),
      cameraPosition: {
        x: this.cameras.main.scrollX,
        y: this.cameras.main.scrollY,
        zoom: this.cameras.main.zoom,
      },
    };

    localStorage.setItem("sandboxSave", JSON.stringify(saveData));
    console.log("Sandbox saved!", saveData);

    // Visual feedback
    const { width, height } = this.cameras.main;
    const text = this.add
      .text(width / 2, height / 2, "Shranjeno!", {
        fontSize: "32px",
        color: "#00aa00",
        backgroundColor: "#ffffff",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    this.tweens.add({
      targets: text,
      alpha: 0,
      duration: 1500,
      ease: "Cubic.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  loadSandbox() {
    const saveData = localStorage.getItem("sandboxSave");
    if (!saveData) {
      console.log("No saved sandbox found");
      return;
    }

    const data = JSON.parse(saveData);

    // Clear existing components
    this.placedComponents.forEach((comp) => comp.destroy());
    this.placedComponents = [];

    // Restore components first
    data.components.forEach((compData, index) => {
      console.log(`Loading component ${index + 1}:`, compData.type, "at", compData.x, compData.y);
      const component = this.createComponent(
        compData.x,
        compData.y,
        compData.type,
        0xffffff,
        false
      );
      component.setData("rotation", compData.rotation);
      component.angle = compData.angle;

      // Restore logic component state
      if (compData.logicComponent && component.getData("logicComponent")) {
        const logicComp = component.getData("logicComponent");
        if (logicComp.type === "switch" && compData.logicComponent.is_on !== undefined) {
          logicComp.is_on = compData.logicComponent.is_on;
          const componentImage = component.list[0];
          if (componentImage) {
            componentImage.setTexture(logicComp.is_on ? "stikalo-on" : "stikalo-off");
          }
        }
      }
    });

    // Restore camera position with validation
    if (data.cameraPosition) {
      // Ensure camera position is within valid bounds
      const scrollX = Phaser.Math.Clamp(data.cameraPosition.x, 0, this.canvasWidth - this.cameras.main.width);
      const scrollY = Phaser.Math.Clamp(data.cameraPosition.y, 0, this.canvasHeight - this.cameras.main.height);
      const zoom = Phaser.Math.Clamp(data.cameraPosition.zoom || 1, 0.5, 2);
      
      this.cameras.main.scrollX = scrollX;
      this.cameras.main.scrollY = scrollY;
      this.cameras.main.setZoom(zoom);
    }

    this.rebuildGraph();

    console.log("Sandbox loaded!", data);

    // Visual feedback
    const { width, height } = this.cameras.main;
    const text = this.add
      .text(width / 2, height / 2, "Naloženo!", {
        fontSize: "32px",
        color: "#3399ff",
        backgroundColor: "#ffffff",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    this.tweens.add({
      targets: text,
      alpha: 0,
      duration: 1500,
      ease: "Cubic.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  clearSandbox() {
    // Clear all placed components
    this.placedComponents.forEach((comp) => comp.destroy());
    this.placedComponents = [];

    // Clear electricity visualization
    this.electricityParticles.forEach((p) => {
      if (p.tween) p.tween.remove();
      p.destroy();
    });
    this.electricityParticles = [];
    this.electricityGraphics.clear();

    // Rebuild graph
    this.rebuildGraph();

    // Clear status text
    this.checkText.setText("");

    console.log("Sandbox cleared");

    // Visual feedback
    const { width, height } = this.cameras.main;
    const text = this.add
      .text(width / 2, height / 2, "Počiščeno!", {
        fontSize: "32px",
        color: "#cc0000",
        backgroundColor: "#ffffff",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    this.tweens.add({
      targets: text,
      alpha: 0,
      duration: 1500,
      ease: "Cubic.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  handleResize(gameSize) {
    // Clear any pending resize timer
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }

    // Wait for resize to finish (user stops dragging) before repositioning
    // This prevents constant repositioning during resize which causes freezing
    this.resizeTimer = setTimeout(() => {
      this.resize(gameSize);
    }, 250); // Wait 250ms after last resize event
  }

  resize(gameSize) {
    // Only resize if scene is still active
    if (!this.scene.isActive()) {
      return;
    }

    try {
      const { width, height } = gameSize;
      
      // Resize left panel height
      if (this.leftPanel) {
        this.leftPanel.setDisplaySize(this.panelWidth, height);
        this.leftPanelOverlay.setDisplaySize(this.panelWidth, height);
      }
      
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
      
      // Reposition buttons
      if (this.uiButtons && this.uiButtons.length > 0) {
        const buttonWidth = 180;
        const buttonHeight = 45;
        const cornerRadius = 10;
        
        this.uiButtons.forEach((button, index) => {
          if (!button || !button.text || !button.bg) return;
          
          const yOffset = this.mode === 'challenge' ? (index === 0 ? 75 : 125) : (30 + index * 50);
          const x = width - 140;
          const y = yOffset;
          
          // Reposition button text
          button.text.setPosition(x, y);
          
          // Redraw button background
          button.bg.clear();
          button.bg.fillStyle(0x3399ff, 1);
          button.bg.fillRoundedRect(
            x - buttonWidth / 2,
            y - buttonHeight / 2,
            buttonWidth,
            buttonHeight,
            cornerRadius
          );
        });
      }
      
      // Reposition title text
      if (this.titleText) {
        this.titleText.setPosition(width / 2 + 50, 30);
      }
    } catch (error) {
      console.error('Error during resize:', error);
    }
  }
}
