import Phaser from "phaser";
import { Theme } from "../ui/theme";
import UIButton from "../ui/UIButton";

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
    this.particles = [];
    this.floatingElements = [];
  }

  create() {
    const { width, height } = this.scale;

    this.children.removeAll(true);
    this.particles = [];
    this.floatingElements = [];

    // Background
    this.createBackground(width, height);

    // Animated particles
    this.createParticles(width, height);

    // Floating geometric shapes
    this.createFloatingShapes(width, height);

    // Main UI
    this.createUI(width, height);

    // Add resize listener
    this.scale.on("resize", this.resize, this);

    // Auto-login check
    const username = localStorage.getItem("username");
    if (username) {
      this.scene.start("LabScene");
    }
  }

  createBackground(width, height) {
    this.cameras.main.setBackgroundColor(Theme.colors.background);

    // Gradient
    const bg = this.add.graphics();
    bg.fillGradientStyle(
      Theme.colors.background,
      Theme.colors.background,
      0x1e1b4b, // Deep indigo
      0x312e81, // Indigo
      1
    );
    bg.fillRect(0, 0, width, height);
    bg.setDepth(-100);

    // Grid
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, Theme.colors.primary, 0.05);
    gridGraphics.setDepth(-90);

    const gridSize = 60;
    for (let x = 0; x < width; x += gridSize) {
      gridGraphics.beginPath();
      gridGraphics.moveTo(x, 0);
      gridGraphics.lineTo(x, height);
      gridGraphics.strokePath();
    }
    for (let y = 0; y < height; y += gridSize) {
      gridGraphics.beginPath();
      gridGraphics.moveTo(0, y);
      gridGraphics.lineTo(width, y);
      gridGraphics.strokePath();
    }
  }

  createParticles(width, height) {
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const size = Phaser.Math.Between(2, 4);
      const alpha = Phaser.Math.FloatBetween(0.1, 0.4);

      const particle = this.add.circle(x, y, size, Theme.colors.primary, alpha);
      particle.setDepth(-80);
      this.particles.push(particle);

      this.tweens.add({
        targets: particle,
        y: y - Phaser.Math.Between(50, 150),
        alpha: { from: alpha, to: 0 },
        duration: Phaser.Math.Between(3000, 6000),
        repeat: -1,
        yoyo: true,
        ease: "Sine.easeInOut",
      });
    }
  }

  createFloatingShapes(width, height) {
    const shapes = [
      {
        x: width * 0.15,
        y: height * 0.2,
        size: 80,
        color: Theme.colors.secondary,
      },
      {
        x: width * 0.85,
        y: height * 0.3,
        size: 100,
        color: Theme.colors.primary,
      },
      {
        x: width * 0.12,
        y: height * 0.75,
        size: 60,
        color: Theme.colors.accent,
      },
      {
        x: width * 0.88,
        y: height * 0.8,
        size: 70,
        color: Theme.colors.secondary,
      },
    ];

    shapes.forEach((shape) => {
      const graphics = this.add.graphics();
      graphics.lineStyle(2, shape.color, 0.1);
      graphics.strokeRoundedRect(
        -shape.size / 2,
        -shape.size / 2,
        shape.size,
        shape.size,
        12
      );
      graphics.setPosition(shape.x, shape.y);
      graphics.setRotation(Phaser.Math.DegToRad(45));
      graphics.setDepth(-70);

      this.tweens.add({
        targets: graphics,
        y: shape.y + 20,
        rotation: graphics.rotation + 0.2,
        duration: 4000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });
  }

  createUI(width, height) {
    const centerX = width / 2;
    const centerY = height / 2;

    // Title
    const titleText = this.add
      .text(centerX, centerY - 80, "ELECTRO MANIA", {
        ...Theme.text.header,
        fontSize: "64px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(centerX, centerY, "Gradi. Simuliraj. Uči se.", {
        ...Theme.text.subheader,
        color: Theme.colors.text.secondary,
        fontSize: "20px",
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    // Enter Button
    new UIButton(
      this,
      centerX,
      centerY + 100,
      "VSTOP V LABORATORIJ",
      () => {
        this.scene.start("LoginScene");
      },
      {
        width: 300, // Increased width to accommodate text
        height: 80, // Increased height for better visibility
        fontSize: "24px", // Adjusted font size for better readability
        color: Theme.colors.primary,
      }
    );

    // Version
    this.add
      .text(width - 20, height - 20, "v1.0.0", {
        fontFamily: Theme.fonts.primary,
        fontSize: "14px",
        color: Theme.colors.text.secondary,
      })
      .setOrigin(1);
  }

  resize(gameSize) {
    const { width, height } = gameSize;
    this.scene.restart();
  }
}
