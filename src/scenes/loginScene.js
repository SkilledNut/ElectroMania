import Phaser from "phaser";
import { config } from "../config.js";
import { Theme } from "../ui/theme";
import UIButton from "../ui/UIButton";
import UIPanel from "../ui/UIPanel";

export default class LoginScene extends Phaser.Scene {
  constructor() {
    super("LoginScene");
  }

  create() {
    const { width, height } = this.scale;
    let isRegisterMode = false;

    // Background
    this.createBackground(width, height);
    this.createParticles(width, height);

    const centerX = width / 2;
    const centerY = height / 2;

    // Panel
    const panelWidth = Math.min(480, width * 0.9);
    const panelHeight = 450;
    new UIPanel(this, centerX, centerY, panelWidth, panelHeight, "PRIJAVA");

    // Input styling
    const inputWidth = Math.min(380, panelWidth - 40);
    const inputHeight = 50;
    const inputStyle = `
        position: absolute;
        width: ${inputWidth}px;
        height: ${inputHeight}px;
        left: ${centerX - inputWidth / 2}px;
        background: rgba(30, 41, 59, 0.5);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 8px;
        padding: 0 16px;
        color: #f8fafc;
        font-size: 16px;
        font-family: 'Inter', sans-serif;
        outline: none;
        transition: all 0.2s ease;
        box-sizing: border-box;
    `;

    // Username Input
    const username = document.createElement("input");
    username.type = "text";
    username.placeholder = "Uporabniško ime";
    username.style.cssText =
      inputStyle + `top: ${centerY - panelHeight / 2 + 120}px;`;

    const handleFocus = (e) => {
      e.target.style.borderColor = "#3b82f6";
      e.target.style.background = "rgba(30, 41, 59, 0.8)";
    };
    const handleBlur = (e) => {
      e.target.style.borderColor = "rgba(148, 163, 184, 0.2)";
      e.target.style.background = "rgba(30, 41, 59, 0.5)";
    };

    username.addEventListener("focus", handleFocus);
    username.addEventListener("blur", handleBlur);
    document.body.appendChild(username);

    // Password Input
    const password = document.createElement("input");
    password.type = "password";
    password.placeholder = "Geslo";
    password.style.cssText =
      inputStyle + `top: ${centerY - panelHeight / 2 + 190}px;`;
    password.addEventListener("focus", handleFocus);
    password.addEventListener("blur", handleBlur);
    document.body.appendChild(password);

    // Register Checkbox
    const checkboxContainer = document.createElement("div");
    checkboxContainer.style.cssText = `
        position: absolute;
        left: ${centerX - inputWidth / 2}px;
        top: ${centerY - panelHeight / 2 + 260}px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: 'Inter', sans-serif;
    `;

    const registerCheckbox = document.createElement("input");
    registerCheckbox.type = "checkbox";
    registerCheckbox.id = "registerMode";
    registerCheckbox.style.cssText = `
        width: 18px;
        height: 18px;
        cursor: pointer;
        accent-color: #3b82f6;
    `;

    const checkboxLabel = document.createElement("label");
    checkboxLabel.htmlFor = "registerMode";
    checkboxLabel.textContent = "Ustvari nov račun";
    checkboxLabel.style.cssText = `
        font-size: 14px;
        color: #94a3b8;
        cursor: pointer;
        user-select: none;
    `;

    checkboxContainer.appendChild(registerCheckbox);
    checkboxContainer.appendChild(checkboxLabel);
    document.body.appendChild(checkboxContainer);

    // Update title on checkbox change
    // Note: The UIPanel title is static text, so we need to find it or just overlay a new one.
    // Actually, UIPanel creates a text object. I didn't expose it.
    // For simplicity, I'll just update the text if I can access it, or just leave it as "SIGN IN / REGISTER" or generic "WELCOME".
    // Or I can recreate the panel title.
    // Let's just change the logic to update a text object I create here.
    // Wait, UIPanel creates the title. I should probably make UIPanel return the title object or have a method to set title.
    // For now, I'll just add a separate text object for the title if I want it dynamic, or just accept "SIGN IN" for both.
    // Let's make it dynamic by overlaying text (hacky) or modifying UIPanel.
    // I'll modify UIPanel later if needed. For now, let's just use "AUTHENTICATION" or similar if I can't change it easily.
    // Actually, I can just access the children of the container if I really want to.
    // But let's just use a variable for the title text object if I create it outside.
    // I'll stick to "SIGN IN" for now as the default.

    registerCheckbox.addEventListener("change", () => {
      isRegisterMode = registerCheckbox.checked;
      // Ideally update title here
    });

    // Submit Button
    const buttonY = centerY + panelHeight / 2 - 60;
    new UIButton(
      this,
      centerX,
      buttonY,
      "NADALJUJ",
      async () => {
        const usernameTrim = username.value.trim();
        const passwordTrim = password.value.trim();

        if (!usernameTrim || !passwordTrim) {
          this.showNotification(
            "Prosim vnesite uporabniško ime in geslo!",
            centerX,
            centerY + 200
          );
          return;
        }

        if (usernameTrim.length < 3) {
          this.showNotification(
            "Uporabniško ime mora imeti vsaj 3 znake!",
            centerX,
            centerY + 200
          );
          return;
        }

        if (passwordTrim.length < 6) {
          this.showNotification(
            "Geslo mora imeti vsaj 6 znakov!",
            centerX,
            centerY + 200
          );
          return;
        }

        const pfps = [
          "avatar1",
          "avatar2",
          "avatar3",
          "avatar4",
          "avatar5",
          "avatar6",
          "avatar7",
          "avatar8",
          "avatar9",
          "avatar10",
          "avatar11",
        ];
        const pfpKey = pfps[Math.floor(Math.random() * pfps.length)];

        try {
          const endpoint = isRegisterMode ? "/auth/register" : "/auth/login";
          const response = await fetch(`${config.API_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: usernameTrim,
              password: passwordTrim,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            const errorMsg =
              data.message || data.errors?.[0]?.msg || "Napaka pri povezavi";
            this.showNotification(errorMsg, centerX, centerY + 200);
            return;
          }

          localStorage.setItem("token", data.token);
          localStorage.setItem("username", data.username);
          localStorage.setItem("userId", data._id);
          localStorage.setItem("profilePic", pfpKey);

          if (data.currentChallengeIndex !== undefined) {
            localStorage.setItem(
              "currentChallengeIndex",
              data.currentChallengeIndex
            );
          }

          this.cleanupDOM(username, password, checkboxContainer);
          this.scene.start("LabScene");
        } catch (error) {
          console.error("Error:", error);
          this.showNotification(
            "Napaka pri povezavi s strežnikom.",
            centerX,
            centerY + 200
          );
        }
      },
      { width: inputWidth, height: 50 }
    );

    // Back Button
    const backBtn = this.add
      .text(40, 40, "← Nazaj", {
        ...Theme.text.body,
        color: Theme.colors.text.secondary,
      })
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => backBtn.setColor(Theme.colors.text.primary))
      .on("pointerout", () => backBtn.setColor(Theme.colors.text.secondary))
      .on("pointerdown", () => {
        this.cleanupDOM(username, password, checkboxContainer);
        this.scene.start("MenuScene");
      });

    // Cleanup
    this.events.once("shutdown", () => {
      this.cleanupDOM(username, password, checkboxContainer);
    });

    // Resize
    this.scale.on("resize", () => {
      this.cleanupDOM(username, password, checkboxContainer);
      this.scene.restart();
    });
  }

  cleanupDOM(username, password, checkboxContainer) {
    if (username && username.parentNode) username.remove();
    if (password && password.parentNode) password.remove();
    if (checkboxContainer && checkboxContainer.parentNode)
      checkboxContainer.remove();
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

    // Grid
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
    // Reuse particle logic from MenuScene or similar
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      this.add
        .circle(x, y, Phaser.Math.Between(2, 4), Theme.colors.primary, 0.2)
        .setDepth(-80);
    }
  }

  showNotification(message, x, y) {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(Theme.colors.danger, 0.2);
    bg.fillRoundedRect(-200, -20, 400, 40, 8);
    bg.lineStyle(1, Theme.colors.danger, 0.5);
    bg.strokeRoundedRect(-200, -20, 400, 40, 8);

    const text = this.add
      .text(0, 0, message, {
        ...Theme.text.body,
        color: "#fca5a5",
      })
      .setOrigin(0.5);

    container.add([bg, text]);

    this.tweens.add({
      targets: container,
      alpha: 0,
      y: y - 20,
      duration: 2000,
      delay: 2000,
      onComplete: () => container.destroy(),
    });
  }
}
