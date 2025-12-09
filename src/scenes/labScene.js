import Phaser from "phaser";
import { Theme } from "../ui/theme";
import UIButton from "../ui/UIButton";

export default class LabScene extends Phaser.Scene {
  constructor() {
    super("LabScene");
  }

  preload() {
    // Load avatars
    for (let i = 1; i <= 11; i++) {
      this.load.image(`avatar${i}`, `src/avatars/avatar${i}.png`);
    }
  }

  create() {
    const { width, height } = this.cameras.main;
    this.scale.on("resize", this.resize, this);

    // Background
    this.createBackground(width, height);
    this.createParticles(width, height);

    const centerX = width / 2;
    const centerY = height / 2;

    const username = localStorage.getItem("username");
    const pfp = localStorage.getItem("profilePic");

    // Top Bar
    this.createTopBar(width, username, pfp);

    // Hero Section
    const heroText = this.add
      .text(centerX, centerY - 120, "Pripravljen na gradnjo vezij?", {
        ...Theme.text.header,
        fontSize: "42px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const subText = this.add
      .text(
        centerX,
        centerY - 60,
        "Začni ustvarjati električna vezja in rešuj izzive",
        {
          ...Theme.text.subheader,
          fontSize: "18px",
          color: Theme.colors.text.secondary,
        }
      )
      .setOrigin(0.5)
      .setAlpha(0);

    // Animations
    this.tweens.add({
      targets: heroText,
      alpha: 1,
      y: centerY - 100,
      duration: 800,
      ease: "Back.easeOut",
    });
    this.tweens.add({ targets: subText, alpha: 1, duration: 800, delay: 200 });

    // Mode Cards
    const isSmallScreen = width < 768;
    const cardY = centerY + 80;

    if (isSmallScreen) {
      this.createModeCard(
        centerX,
        centerY + 40,
        "Način z izzivi",
        "Preizkusi svoje znanje",
        Theme.colors.primary,
        () => this.startMode("challenge")
      );
      this.createModeCard(
        centerX,
        centerY + 220,
        "Peskovnik",
        "Prosto eksperimentiraj",
        Theme.colors.warning,
        () => this.startMode("sandbox")
      );
    } else {
      this.createModeCard(
        centerX - 180,
        cardY,
        "Način z izzivi",
        "Preizkusi svoje znanje s strukturiranimi izzivi",
        Theme.colors.primary,
        () => this.startMode("challenge")
      );
      this.createModeCard(
        centerX + 180,
        cardY,
        "Peskovnik",
        "Prosto eksperimentiraj z vezji",
        Theme.colors.warning,
        () => this.startMode("sandbox")
      );
    }
  }

  startMode(mode) {
    this.cameras.main.fade(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.start("WorkspaceScene", { mode });
    });
  }

  createBackground(width, height) {
    this.cameras.main.setBackgroundColor(Theme.colors.background);
    const bg = this.add.graphics();
    bg.fillGradientStyle(
      Theme.colors.background,
      Theme.colors.background,
      0x1e1b4b,
      0x312e81,
      1
    );
    bg.fillRect(0, 0, width, height);
    bg.setDepth(-100);

    const grid = this.add.graphics();
    grid.lineStyle(1, Theme.colors.primary, 0.05);
    const size = 60;
    for (let x = 0; x < width; x += size) {
      grid.moveTo(x, 0);
      grid.lineTo(x, height);
    }
    for (let y = 0; y < height; y += size) {
      grid.moveTo(0, y);
      grid.lineTo(width, y);
    }
    grid.strokePath();
    grid.setDepth(-90);
  }

  createParticles(width, height) {
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      this.add
        .circle(x, y, Phaser.Math.Between(2, 4), Theme.colors.primary, 0.2)
        .setDepth(-80);
    }
  }

  createTopBar(width, username, pfp) {
    const barHeight = 80;
    const bar = this.add.graphics();
    bar.fillStyle(Theme.colors.surface, 0.9);
    bar.fillRect(0, 0, width, barHeight);
    bar.lineStyle(1, Theme.colors.border, 1);
    bar.lineBetween(0, barHeight, width, barHeight);

    // Avatar
    if (pfp) {
      const avatarBg = this.add.circle(60, 40, 24, Theme.colors.primary, 0.2);
      const img = this.add.image(60, 40, pfp).setDisplaySize(40, 40);
      const mask = avatarBg.createGeometryMask();
      img.setMask(mask);
    }

    // Username
    if (width > 600 && username) {
      this.add
        .text(100, 40, username, {
          ...Theme.text.body,
          fontSize: "18px",
          fontStyle: "600",
        })
        .setOrigin(0, 0.5);
    }

    // Buttons
    const btnStyle = {
      ...Theme.text.button,
      fontSize: "14px",
      color: Theme.colors.text.secondary,
    };

    // Logout
    const logoutBtn = this.add
      .text(width - 100, 40, "Odjava", btnStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => logoutBtn.setColor(Theme.colors.text.primary))
      .on("pointerout", () => logoutBtn.setColor(Theme.colors.text.secondary))
      .on("pointerdown", () => {
        localStorage.removeItem("username");
        this.scene.start("MenuScene");
      });

    // Leaderboard
    const lbBtn = this.add
      .text(width - 200, 40, "Lestvica", btnStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => lbBtn.setColor(Theme.colors.text.primary))
      .on("pointerout", () => lbBtn.setColor(Theme.colors.text.secondary))
      .on("pointerdown", () => {
        this.scene.start("ScoreboardScene", { cameFromMenu: true });
      });
  }

  createModeCard(x, y, title, description, color, callback) {
    const width = 300;
    const height = 180;
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    const drawBg = (c, alpha) => {
      bg.clear();
      bg.fillStyle(Theme.colors.surface, alpha);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 16);
      bg.lineStyle(2, c, 0.5);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 16);
    };
    drawBg(color, 0.6);
    container.add(bg);

    // Icon
    container.add(this.add.circle(0, -40, 30, color, 0.2));
    container.add(
      this.add.text(0, -40, "⚡", { fontSize: "32px" }).setOrigin(0.5)
    );

    // Text
    container.add(
      this.add
        .text(0, 10, title, {
          ...Theme.text.header,
          fontSize: "20px",
        })
        .setOrigin(0.5)
    );

    container.add(
      this.add
        .text(0, 45, description, {
          ...Theme.text.body,
          fontSize: "14px",
          color: Theme.colors.text.secondary,
          align: "center",
          wordWrap: { width: width - 40 },
        })
        .setOrigin(0.5)
    );

    // Interactive
    container.setSize(width, height);
    container.setInteractive({ useHandCursor: true });

    container.on("pointerover", () => {
      this.tweens.add({ targets: container, scale: 1.05, duration: 200 });
      drawBg(color, 0.8);
    });

    container.on("pointerout", () => {
      this.tweens.add({ targets: container, scale: 1, duration: 200 });
      drawBg(color, 0.6);
    });

    container.on("pointerdown", callback);

    // Entrance
    container.setAlpha(0).setY(y + 20);
    this.tweens.add({
      targets: container,
      alpha: 1,
      y: y,
      duration: 600,
      delay: 400,
      ease: "Back.easeOut",
    });
  }

  resize(gameSize) {
    const { width, height } = gameSize;
    this.scene.restart();
  }
}
