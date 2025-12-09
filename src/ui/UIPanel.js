import Phaser from "phaser";
import { Theme } from "./theme";

export default class UIPanel extends Phaser.GameObjects.Container {
  constructor(scene, x, y, width, height, title) {
    super(scene, x, y);

    // Glassmorphism Background
    const bg = scene.add.graphics();
    bg.fillStyle(Theme.colors.surface, 0.8); // Semi-transparent dark blue
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 24);

    // Border/Stroke
    bg.lineStyle(1, 0xffffff, 0.1);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 24);

    this.add(bg);

    // Title
    if (title) {
      const titleText = scene.add
        .text(0, -height / 2 + 40, title, Theme.text.header)
        .setOrigin(0.5)
        .setFontSize(32);
      this.add(titleText);

      // Divider line
      const line = scene.add.graphics();
      line.lineStyle(2, Theme.colors.primary, 0.5);
      line.beginPath();
      line.moveTo(-width / 2 + 40, -height / 2 + 80);
      line.lineTo(width / 2 - 40, -height / 2 + 80);
      line.strokePath();
      this.add(line);
    }

    scene.add.existing(this);
  }
}
