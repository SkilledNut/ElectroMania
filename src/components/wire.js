import { Node } from '../logic/node.js';
import { Component } from './component.js';

// Available wire colors (using bright values for tint multiplication)
const WIRE_COLORS = {
    none: { name: 'Originalna', hex: null }, // No tint - original image
    red: { name: 'Rdeča', hex: 0xff6666 },
    blue: { name: 'Modra', hex: 0x6699ff },
    green: { name: 'Zelena', hex: 0x66ff66 },
    yellow: { name: 'Rumena', hex: 0xffff66 },
    orange: { name: 'Oranžna', hex: 0xffaa66 },
    cyan: { name: 'Turkizna', hex: 0x66ffff },
    purple: { name: 'Vijolična', hex: 0xcc99ff }
};

class Wire extends Component{
    constructor(id, start, end, path = [], color = 'none') {
        super(id, 'wire', start, end, 'src/components/wire.png', true);
        this.is_connected = false;
        this.debug_color = 0x0000ff;
        this.wireColor = color; // Wire color key (e.g., 'red', 'blue')
    }

    /**
     * Set the wire color
     */
    setColor(colorKey) {
        if (WIRE_COLORS[colorKey] !== undefined) {
            this.wireColor = colorKey;
        }
    }

    /**
     * Get the hex color value for rendering (null means no tint)
     */
    getColorHex() {
        return WIRE_COLORS[this.wireColor]?.hex;
    }

    /**
     * Get all available colors
     */
    static getAvailableColors() {
        return WIRE_COLORS;
    }
}

export { Wire, WIRE_COLORS };