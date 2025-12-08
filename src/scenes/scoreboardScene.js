import Phaser from 'phaser';
import { config } from '../config'; // new import to call backend
export default class ScoreboardScene extends Phaser.Scene {
    constructor() {
        super('ScoreboardScene');
    }

    init(data) {
        this.cameFromMenu = data.cameFromMenu || false;
    }

    preload() {
        // avatarji
        for (let i = 1; i <= 14; i++) {
            this.load.image(`avatar${i}`, `src/avatars/avatar${i}.png`);
        }
    }

    create() {
        const { width, height } = this.scale;

        // Add resize listener
        this.scale.on('resize', this.resize, this);

        // ozadje
        // svetla stena
        this.add.rectangle(0, 0, width, height - 150, 0xe8e8e8).setOrigin(0);
        // tla
        this.add.rectangle(0, height - 150, width, 150, 0xd4c4a8).setOrigin(0);

        // miza
        const tableX = width / 2;
        const tableY = height / 2 + 50;
        const tableWidth = 600;
        const tableHeight = 280;

        this.add.rectangle(tableX, tableY, tableWidth, 30, 0x8b4513).setOrigin(0.5);
        const surface = this.add.rectangle(tableX, tableY + 15, tableWidth - 30, tableHeight - 30, 0xa0826d).setOrigin(0.5, 0);

        // mreža
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x8b7355, 0.3);
        const gridSize = 30;
        const gridStartX = tableX - (tableWidth - 30) / 2;
        const gridStartY = tableY + 15;
        const gridEndX = tableX + (tableWidth - 30) / 2;
        const gridEndY = tableY + 15 + (tableHeight - 30);

        for (let x = gridStartX; x <= gridEndX; x += gridSize) {
            grid.beginPath();
            grid.moveTo(x, gridStartY);
            grid.lineTo(x, gridEndY);
            grid.strokePath();
        }
        for (let y = gridStartY; y <= gridEndY; y += gridSize) {
            grid.beginPath();
            grid.moveTo(gridStartX, y);
            grid.lineTo(gridEndX, y);
            grid.strokePath();
        }

        // nogice mize
        const legWidth = 20;
        const legHeight = 150;
        this.add.rectangle(tableX - tableWidth / 2 + 40, tableY + tableHeight / 2 + 20, legWidth, legHeight, 0x654321);
        this.add.rectangle(tableX + tableWidth / 2 - 40, tableY + tableHeight / 2 + 20, legWidth, legHeight, 0x654321);

        // okvir
        const panelWidth = 600;
        const panelHeight = 400;
        const panelX = width / 2 - panelWidth / 2;
        const panelY = height / 2 - panelHeight / 2 - 30;

        const panel = this.add.graphics();
        panel.fillStyle(0xffffff, 0.92);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 25);
        panel.lineStyle(3, 0xcccccc, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 25);

        // naslov
        this.add.text(width / 2, panelY + 35, 'LESTVICA', {
            fontFamily: 'Arial',
            fontSize: '36px',
            fontStyle: 'bold',
            color: '#222'
        }).setOrigin(0.5);

        // prepare container where rows will be rendered
        this.leaderboardStartY = panelY + 90;
        this.leaderboardPanelX = panelX;
        this.leaderboardPanelWidth = panelWidth;
        this.userLogged = localStorage.getItem('username');

        // Load users (from backend if possible) then render
        this.loadLeaderboard();
        

        // ESC tipka
        this.input.keyboard.on('keydown-ESC', () => {
            if (this.cameFromMenu) {
                this.scene.start('LabScene');
            }
            else {
                this.scene.start('LabScene');
            }
        });

        // gumb
        if (this.cameFromMenu === false) {
            const backButton = this.add.text(width / 2, panelY + panelHeight - 40, '↩ Nazaj', {
                fontFamily: 'Arial',
                fontSize: '22px',
                color: '#0066ff',
                padding: { x: 20, y: 10 }
            })
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true })
                .on('pointerover', () => backButton.setStyle({ color: '#0044cc' }))
                .on('pointerout', () => backButton.setStyle({ color: '#0066ff' }))
                .on('pointerdown', () => {
                    this.scene.start('WorkspaceScene');
                });
        }

    }

    async loadLeaderboard() {
        const token = localStorage.getItem('token');
        let users = JSON.parse(localStorage.getItem('users')) || [];

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const resp = await fetch(`${config.API_URL}/auth/leaderboard`, { headers });
            if (resp.ok) {
                const serverUsers = await resp.json();
                users = serverUsers.map(u => ({
                    username: u.username,
                    profilePic: u.profilePic,
                    points: u.points ?? u.score ?? 0
                }));
                localStorage.setItem('users', JSON.stringify(users));
            } else {
                console.warn('Failed to fetch leaderboard from server', await resp.text());
            }
        } catch (err) {
            console.warn('Error fetching leaderboard:', err);
        }


        const userToUpdate = users.find(u => u.username === 'enej');
        if (userToUpdate) {
            userToUpdate.points = 130;
            userToUpdate.score = 130;
            localStorage.setItem('users', JSON.stringify(users));
        }

        users.sort((a, b) => ((b.points ?? b.score ?? 0) - (a.points ?? a.score ?? 0)));

        this.renderLeaderboard(users);
    }

    renderLeaderboard(users) {
        const panelX = this.leaderboardPanelX;
        const panelY = this.leaderboardStartY;
        const panelWidth = this.leaderboardPanelWidth;
        const userLogged = this.userLogged;

        users.forEach((user, index) => {
            const y = panelY + index * 35;
            const rank = index + 1;

            if (user.profilePic) {
                this.add.image(panelX + 60, y + 15, user.profilePic)
                    .setDisplaySize(40, 40)
                    .setOrigin(0.5);
            }

            this.add.text(panelX + 100, y + 5, `${rank}.`, { fontSize: '22px', color: '#444' });

            const style = (user.username === userLogged)
                ? { fontSize: '22px', color: '#0f5cad', fontStyle: 'bold' }
                : { fontSize: '22px', color: '#222' };
            this.add.text(panelX + 140, y + 5, user.username, style);

            const pointsToShow = user.points ?? user.score ?? 0;
            this.add.text(panelX + panelWidth - 100, y + 5, `${pointsToShow}`, {
                fontSize: '22px',
                color: '#0044cc'
            }).setOrigin(1, 0);
        });
    }

    resize(gameSize) {
        const { width, height } = gameSize;
        
        // Recreate the entire scene on resize to properly reposition all elements
        this.scene.restart();
    }
}
