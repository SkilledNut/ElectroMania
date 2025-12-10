import Phaser from "phaser";
import { config } from "../config";
import { Theme } from "../ui/theme";
import UIPanel from "../ui/UIPanel";
import UIButton from "../ui/UIButton";

export default class ScoreboardScene extends Phaser.Scene {
    constructor() {
        super("ScoreboardScene");
    }

    init(data) {
        this.cameFromMenu = data.cameFromMenu || false;
    }

    preload() {
        for (let i = 1; i <= 14; i++) {
            this.load.image(`avatar${i}`, `src/avatars/avatar${i}.png`);
        }
    }

    create() {
        const { width, height } = this.scale;
        this.scale.on("resize", this.resize, this);

        // Background
        this.createBackground(width, height);
        this.createParticles(width, height);

        const centerX = width / 2;
        const centerY = height / 2;

        // Panel
        const panelWidth = Math.min(700, width * 0.95);
        const panelHeight = Math.min(550, height * 0.8);
        new UIPanel(
            this,
            centerX,
            centerY,
            panelWidth,
            panelHeight,
            "LESTVICA"
        );

        // Back Button
        const backBtn = this.add
            .text(40, 40, "← Nazaj", {
                ...Theme.text.body,
                color: Theme.colors.text.secondary,
            })
            .setInteractive({ useHandCursor: true })
            .on("pointerover", () =>
                backBtn.setColor(Theme.colors.text.primary)
            )
            .on("pointerout", () =>
                backBtn.setColor(Theme.colors.text.secondary)
            )
            .on("pointerdown", () => {
                this.scene.start(
                    this.cameFromMenu ? "LabScene" : "WorkspaceScene"
                );
            });

        // Leaderboard Setup
        this.leaderboardStartY = centerY - panelHeight / 2 + 100;
        this.leaderboardPanelX = centerX - panelWidth / 2;
        this.leaderboardPanelWidth = panelWidth;
        this.userLogged = localStorage.getItem("username");

        this.loadLeaderboard();

        // ESC key
        this.input.keyboard.on("keydown-ESC", () => {
            this.scene.start(this.cameFromMenu ? "LabScene" : "WorkspaceScene");
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
                .circle(
                    x,
                    y,
                    Phaser.Math.Between(2, 4),
                    Theme.colors.primary,
                    0.2
                )
                .setDepth(-80);
        }
    }

    async loadLeaderboard() {
        const token = localStorage.getItem("token");
        let users = JSON.parse(localStorage.getItem("users")) || [];

        try {
            const headers = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const resp = await fetch(`${config.API_URL}/auth/leaderboard`, {
                headers,
            });
            if (resp.ok) {
                const serverUsers = await resp.json();
                users = serverUsers.map((u) => ({
                    username: u.username,
                    profilePic: u.profilePic,
                    points: u.points ?? u.score ?? 0,
                }));
                localStorage.setItem("users", JSON.stringify(users));
            }
        } catch (err) {
            console.warn("Error fetching leaderboard:", err);
        }

        // Mock update for demo (from original code)
        const userToUpdate = users.find((u) => u.username === "enej");
        if (userToUpdate) {
            userToUpdate.points = 130;
            userToUpdate.score = 130;
            localStorage.setItem("users", JSON.stringify(users));
        }

        users.sort(
            (a, b) => (b.points ?? b.score ?? 0) - (a.points ?? a.score ?? 0)
        );
        this.renderLeaderboard(users);
    }

    renderLeaderboard(users) {
        console.log("renderLeaderboard called, users:", users);
        const panelX = this.leaderboardPanelX;
        const panelY = this.leaderboardStartY;
        const panelWidth = this.leaderboardPanelWidth;
        const userLogged = this.userLogged;
        const isSmallScreen = panelWidth < 500;

        const layer = this.add.container(0, 0).setDepth(50);

        const colorToCss = (c) =>
            typeof c === "number"
                ? `#${c.toString(16).padStart(6, "0")}`
                : String(c);

        const resolveColor = (c) => {
            if (c === undefined || c === null || c === "") return "#ffffff";
            try {
                return colorToCss(c);
            } catch {
                return "#ffffff";
            }
        };

        const baseTextStyle = { ...Theme.text.body };
        baseTextStyle.color = resolveColor(baseTextStyle.color);

        if (!Array.isArray(users) || users.length === 0) {
            const noUsersText = this.add
                .text(panelX + panelWidth / 2, panelY + 20, "No users yet", {
                    ...baseTextStyle,
                })
                .setOrigin(0.5);
            layer.add(noUsersText);
            return;
        }

        const safeUsers = users.filter(Boolean);
        safeUsers.forEach((user, index) => {
            try {
                console.log(`render user[${index}]`, user);
                const y = panelY + index * 50;
                const rank = index + 1;

                // Rank color
                let rankColor = Theme.colors.text.secondary;
                if (rank === 1) rankColor = 0xffd700;
                else if (rank === 2) rankColor = 0xc0c0c0;
                else if (rank === 3) rankColor = 0xcd7f32;
                const rankCircleColor =
                    typeof rankColor === "number" ? rankColor : 0x8b9aff;

                const isCurrentUser =
                    String(user.username || "") === String(userLogged || "");
                if (isCurrentUser) {
                    const highlight = this.add.graphics();
                    highlight.fillStyle(Theme.colors.primary, 0.08);
                    highlight.fillRoundedRect(
                        panelX + 10,
                        y,
                        panelWidth - 20,
                        45,
                        8
                    );
                    layer.add(highlight);
                }

                // Rank circle + text
                const rankX = isSmallScreen ? panelX + 30 : panelX + 50;
                const rankCircle = this.add.circle(
                    rankX,
                    y + 20,
                    18,
                    rankCircleColor,
                    0.2
                );
                const rankTxt = this.add
                    .text(rankX, y + 20, `${rank}`, {
                        ...baseTextStyle,
                        fontStyle: "700",
                    })
                    .setOrigin(0.5);
                layer.add([rankCircle, rankTxt]);

                // Avatar or initials
                const avatarX = isSmallScreen ? panelX + 70 : panelX + 110;
                if (
                    !isSmallScreen &&
                    user.profilePic &&
                    this.textures &&
                    this.textures.exists &&
                    this.textures.exists(user.profilePic)
                ) {
                    const avatarBg = this.add.circle(
                        avatarX,
                        y + 20,
                        20,
                        Theme.colors.primary,
                        0.2
                    );
                    const avatar = this.add
                        .image(avatarX, y + 20, user.profilePic)
                        .setDisplaySize(36, 36);
                    try {
                        avatar.setMask(avatarBg.createGeometryMask());
                    } catch (m) {
                        console.warn("avatar mask failed", m);
                    }
                    layer.add([avatarBg, avatar]);
                } else {
                    const circle = this.add.circle(
                        avatarX,
                        y + 20,
                        20,
                        Theme.colors.primary,
                        0.15
                    );
                    const initials = (
                        String(user.username || "")
                            .split(" ")
                            .map((p) => p[0] || "")
                            .join("")
                            .slice(0, 2) || "?"
                    ).toUpperCase();
                    const initialsTxt = this.add
                        .text(avatarX, y + 20, initials, {
                            ...baseTextStyle,
                            fontStyle: "700",
                        })
                        .setOrigin(0.5)
                        .setColor(resolveColor(Theme.text.primary));
                    layer.add([circle, initialsTxt]);
                }

                // Username
                let displayUsername = user.username ?? "unknown";
                displayUsername = String(displayUsername);
                if (isSmallScreen && displayUsername.length > 10) {
                    displayUsername = displayUsername.substring(0, 8) + "...";
                }
                const usernameX = isSmallScreen ? panelX + 90 : panelX + 160;
                const usernameTxt = this.add
                    .text(usernameX, y + 20, displayUsername, {
                        ...baseTextStyle,
                    })
                    .setOrigin(0, 0.5)
                    .setColor(
                        isCurrentUser
                            ? resolveColor(Theme.text.accent)
                            : resolveColor(Theme.text.primary)
                    );
                layer.add(usernameTxt);

                // Points
                const pointsToShow = Number(user.points ?? user.score ?? 0);
                const pointsWidth = isSmallScreen ? 70 : 90;
                const pointsX =
                    panelX + panelWidth - (isSmallScreen ? 90 : 130);

                const pointsBg = this.add.graphics();
                pointsBg.fillStyle(Theme.colors.primary, 0.2);
                pointsBg.fillRoundedRect(pointsX, y + 8, pointsWidth, 28, 8);
                const pointsTxt = this.add
                    .text(
                        pointsX + pointsWidth / 2,
                        y + 22,
                        `${pointsToShow} pts`,
                        {
                            ...baseTextStyle,
                            fontSize: isSmallScreen ? "14px" : "16px",
                            fontStyle: "600",
                        }
                    )
                    .setOrigin(0.5)
                    .setColor(resolveColor(Theme.text.accent));
                layer.add([pointsBg, pointsTxt]);
            } catch (e) {
                console.error("Error rendering user row:", e, user);
            }
        });
    }

    resize(gameSize) {
        const { width, height } = gameSize;
        this.scene.restart();
    }
}
