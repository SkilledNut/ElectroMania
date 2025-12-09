import Phaser from "phaser";
import { Theme } from "./theme";

export default class UIButton extends Phaser.GameObjects.Container {
  constructor(scene, x, y, text, callback, options = {}) {
    super(scene, x, y);
    this.scene = scene;
    this.callback = callback;

    const width = options.width || 200;
    const height = options.height || 50;
    const primaryColor = options.color || Theme.colors.primary;
    const hoverColor = options.hoverColor || 0x2563eb; // Slightly darker/lighter

    // Shadow/Glow
    this.glow = scene.add.graphics();
    this.glow.fillStyle(primaryColor, 0.3);
    this.glow.fillRoundedRect(
      -width / 2 + 4,
      -height / 2 + 4,
      width,
      height,
      12
    );
    this.glow.setVisible(false);
    this.add(this.glow);

    // Background
    this.bg = scene.add.graphics();
    this.drawBackground(primaryColor, width, height);
    this.add(this.bg);

    // Text
    this.textObj = scene.add
      .text(0, 0, text, {
        ...Theme.text.button,
        fontSize: options.fontSize || "18px",
      })
      .setOrigin(0.5);
    this.add(this.textObj);

    // Interactive
    this.setSize(width, height);
    this.setInteractive({ useHandCursor: true });

    // Events
    this.on("pointerover", () => {
      this.drawBackground(hoverColor, width, height);
      this.glow.setVisible(true);
      this.scene.tweens.add({
        targets: this,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
        ease: "Sine.easeInOut",
      });
    });

    this.on("pointerout", () => {
      this.drawBackground(primaryColor, width, height);
      this.glow.setVisible(false);
      this.scene.tweens.add({
        targets: this,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: "Sine.easeInOut",
      });
    });

    this.on("pointerdown", () => {
      this.scene.tweens.add({
        targets: this,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        yoyo: true,
        ease: "Sine.easeInOut",
        onComplete: () => {
          if (this.callback) this.callback();
        },
      });
    });

    scene.add.existing(this);
  }

  drawBackground(color, width, height) {
    this.bg.clear();
    this.bg.fillStyle(color, 1);
    this.bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12);
  }

  resize(width, height) {
    this.setSize(width, height);
    this.drawBackground(Theme.colors.primary, width, height);
    // Update hit area
    this.input.hitArea.setTo(-width / 2, -height / 2, width, height);
    // Update glow
    this.glow.clear();
    this.glow.fillStyle(Theme.colors.primary, 0.3);
    this.glow.fillRoundedRect(
      -width / 2 + 4,
      -height / 2 + 4,
      width,
      height,
      12
    );
  }
}
