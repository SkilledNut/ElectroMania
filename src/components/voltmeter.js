import { Component } from './component.js';

class Voltmeter extends Component {
    constructor(id, start, end) {
        super(id, 'voltmeter', start, end, 'src/components/voltmeter.png', false);
        this.voltage = 0; // Voltage in Volts
        this.debug_color = 0x00cc66;
    }

    // Voltmeter does NOT conduct electricity (it's in parallel, high resistance)
    conducts() {
        return false;
    }

    // Set the measured voltage
    setVoltage(voltage) {
        this.voltage = voltage;
    }

    // Get the voltage reading
    getVoltage() {
        return this.voltage;
    }
}

export { Voltmeter };
