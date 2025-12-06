/**
 * CircuitGraph - Complete rewrite for robust circuit analysis
 *
 * Core concepts:
 * 1. Components have two terminals (start/end) with world coordinates
 * 2. Terminals within CONNECTION_THRESHOLD distance are electrically connected
 * 3. We build a connection map: position -> list of components touching that position
 * 4. Path finding uses BFS to find routes from battery positive to negative
 */

class CircuitGraph {
  constructor() {
    this.components = [];
    this.CONNECTION_THRESHOLD = 60; // Snap distance for electrical connection
  }

  /**
   * Clear and rebuild the entire circuit from placed components
   */
  clear() {
    this.components = [];
  }

  /**
   * Add a component to the circuit
   * Component must have: id, type, start {x, y}, end {x, y}
   */
  addComponent(component) {
    if (!component || !component.start || !component.end) {
      console.warn("[Graph] Invalid component, skipping:", component);
      return;
    }

    // Store the component
    this.components.push({
      id: component.id,
      type: component.type,
      start: {
        x: Math.round(component.start.x),
        y: Math.round(component.start.y),
      },
      end: { x: Math.round(component.end.x), y: Math.round(component.end.y) },
      is_on: component.is_on !== undefined ? component.is_on : true, // For switches
      originalComponent: component, // Keep reference for updating state
    });
  }

  /**
   * Check if a component conducts electricity
   */
  isConductive(comp) {
    if (!comp) return false;

    // Battery is NOT conductive (it's a source, not a path)
    if (comp.type === "battery") return false;

    // Voltmeter does NOT conduct (parallel connection, high resistance)
    if (comp.type === "voltmeter") return false;

    // Switch conductivity depends on state
    if (comp.type === "switch") return comp.is_on === true;

    // Wires, bulbs, resistors, and ammeters conduct
    return ["wire", "bulb", "resistor", "ammeter"].includes(comp.type);
  }

  /**
   * Get position key for terminal grouping
   */
  posKey(x, y) {
    return `${Math.round(x)},${Math.round(y)}`;
  }

  /**
   * Check if two positions are close enough to be electrically connected
   */
  areConnected(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.hypot(dx, dy) <= this.CONNECTION_THRESHOLD;
  }

  /**
   * Build a connection map: each position maps to list of components with a terminal there
   * Returns: { positionKey: [{component, terminal: 'start'|'end'}] }
   */
  buildConnectionMap() {
    const connectionMap = new Map();

    for (const comp of this.components) {
      // Add start terminal
      const startKey = this.posKey(comp.start.x, comp.start.y);
      if (!connectionMap.has(startKey)) {
        connectionMap.set(startKey, []);
      }
      connectionMap.get(startKey).push({ component: comp, terminal: "start" });

      // Add end terminal
      const endKey = this.posKey(comp.end.x, comp.end.y);
      if (!connectionMap.has(endKey)) {
        connectionMap.set(endKey, []);
      }
      connectionMap.get(endKey).push({ component: comp, terminal: "end" });
    }

    // Merge nearby positions within CONNECTION_THRESHOLD
    const mergedMap = new Map();
    const processed = new Set();

    for (const [key1, terminals1] of connectionMap) {
      if (processed.has(key1)) continue;

      const [x1, y1] = key1.split(",").map(Number);
      const mergedTerminals = [...terminals1];
      processed.add(key1);

      // Find all nearby positions
      for (const [key2, terminals2] of connectionMap) {
        if (key1 === key2 || processed.has(key2)) continue;

        const [x2, y2] = key2.split(",").map(Number);
        if (this.areConnected({ x: x1, y: y1 }, { x: x2, y: y2 })) {
          mergedTerminals.push(...terminals2);
          processed.add(key2);
        }
      }

      mergedMap.set(key1, mergedTerminals);
    }

    return mergedMap;
  }

  /**
   * Find all complete paths from battery positive to battery negative
   * Returns array of paths, where each path is array of component IDs
   */
  findCircuitPaths() {
    // Find the battery
    const battery = this.components.find((c) => c.type === "battery");
    if (!battery) {
      console.log("[Graph] No battery found");
      return [];
    }

    console.log("[Graph] Finding paths from battery", battery.id);
    console.log("[Graph] Battery terminals:", battery.start, battery.end);

    // Build connection map
    const connectionMap = this.buildConnectionMap();

    console.log(
      "[Graph] Connection map built with",
      connectionMap.size,
      "junction points"
    );
    for (const [key, terminals] of connectionMap) {
      console.log(
        `  Junction ${key}:`,
        terminals.map(
          (t) => `${t.component.type}(${t.component.id}):${t.terminal}`
        )
      );
    }

    // BFS from battery start to battery end
    const startKey = this.posKey(battery.start.x, battery.start.y);
    const targetKey = this.posKey(battery.end.x, battery.end.y);

    console.log("[Graph] Searching from", startKey, "to", targetKey);

    const allPaths = [];
    const queue = [
      {
        posKey: startKey,
        visited: new Set(),
        path: [],
      },
    ];

    let iterations = 0;
    const MAX_ITERATIONS = 10000;

    while (queue.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;
      const { posKey, visited, path } = queue.shift();

      // Check if we reached the target
      if (posKey === targetKey && path.length > 0) {
        console.log(
          "[Graph] ✓ Found complete path:",
          path.map((c) => `${c.type}(${c.id})`).join(" -> ")
        );
        allPaths.push(path);
        continue;
      }

      // Get all terminals at this position
      const terminals = connectionMap.get(posKey) || [];

      for (const { component, terminal } of terminals) {
        // Skip if already visited this component
        if (visited.has(component.id)) continue;

        // Skip non-conductive components
        if (!this.isConductive(component)) {
          console.log(
            `[Graph]   Skip ${component.type}(${component.id}) - not conductive`
          );
          continue;
        }

        // Traverse to the other end of this component
        const otherTerminal = terminal === "start" ? "end" : "start";
        const nextPos = component[otherTerminal];
        const nextPosKey = this.posKey(nextPos.x, nextPos.y);

        // Create new state for this path
        const newVisited = new Set(visited);
        newVisited.add(component.id);
        const newPath = [...path, component];

        console.log(
          `[Graph]   Traverse ${component.type}(${component.id}) from ${posKey} to ${nextPosKey}`
        );

        queue.push({
          posKey: nextPosKey,
          visited: newVisited,
          path: newPath,
        });
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      console.warn("[Graph] Max iterations reached in BFS");
    }

    console.log(`[Graph] Found ${allPaths.length} complete circuit path(s)`);
    return allPaths;
  }

  /**
   * Check if the circuit is complete (at least one path exists)
   */
  isCircuitComplete() {
    const paths = this.findCircuitPaths();
    return paths.length > 0;
  }

  /**
   * Check if a voltmeter is properly connected to the circuit
   */
  isVoltmeterConnected(voltmeter) {
    // Build connection map to check if voltmeter terminals touch other components
    const connectionMap = this.buildConnectionMap();
    
    const startKey = this.posKey(voltmeter.start.x, voltmeter.start.y);
    const endKey = this.posKey(voltmeter.end.x, voltmeter.end.y);
    
    const startTerminals = connectionMap.get(startKey) || [];
    const endTerminals = connectionMap.get(endKey) || [];
    
    // Check if at least one other component (not the voltmeter itself) is at each terminal
    const startHasConnection = startTerminals.some(t => t.component.id !== voltmeter.id);
    const endHasConnection = endTerminals.some(t => t.component.id !== voltmeter.id);
    
    return startHasConnection && endHasConnection;
  }

  /**
   * Calculate circuit measurements (voltage and current)
   */
  calculateMeasurements(paths) {
    const battery = this.components.find((c) => c.type === "battery");
    if (!battery || paths.length === 0) {
      return { voltage: 0, current: 0 };
    }

    // Assume battery voltage is 3.3V (as mentioned in component details)
    const batteryVoltage = 3.3;

    // Simple calculation: count resistive elements in the longest path
    let maxPathLength = 0;
    for (const path of paths) {
      const resistiveCount = path.filter(c => 
        ["resistor", "bulb", "ammeter"].includes(c.type)
      ).length;
      maxPathLength = Math.max(maxPathLength, resistiveCount);
    }

    // Assume each resistor/bulb has 1Ω resistance, ammeter has negligible resistance
    // Using Ohm's law: I = V / R
    const totalResistance = maxPathLength > 0 ? maxPathLength : 1;
    const current = batteryVoltage / totalResistance;

    return {
      voltage: batteryVoltage,
      current: current,
    };
  }

  /**
   * Simulate the circuit and update component states
   * Returns: { status: number, paths: array of component arrays, measurements: object }
   */
  simulate() {
    const paths = this.findCircuitPaths();
    const isComplete = paths.length > 0;

    // Calculate measurements
    const measurements = this.calculateMeasurements(paths);

    // Update bulbs based on circuit state
    const bulbs = this.components.filter((c) => c.type === "bulb");
    for (const bulb of bulbs) {
      if (bulb.originalComponent) {
        bulb.originalComponent.is_on = isComplete;
      }
    }

    const battery = this.components.find((c) => c.type === "battery");
    if (!battery) {
      console.log("[Graph] No battery found, circuit is OPEN");
      return { status: -1, paths: [] };
    }

    if (isComplete) {
      console.log(`[Graph] Circuit is COMPLETE`);
      console.log(`[Graph] ${bulbs.length} bulb(s) turned ON`);
      return { status: 1, paths: paths };
    }

    const hasSwitch = this.components.some((c) => c.type === "switch");
    const anySwitchOff = this.components.some(
      (c) => c.type === "switch" && c.is_on === false
    // Update ammeters - they show current if in a complete path
    const ammeters = this.components.filter((c) => c.type === "ammeter");
    for (const ammeter of ammeters) {
      const isInPath = paths.some(path => 
        path.some(comp => comp.id === ammeter.id)
      );
      if (ammeter.originalComponent) {
        ammeter.originalComponent.current = isInPath && isComplete ? measurements.current : 0;
      }
    }

    // Update voltmeters - check if both terminals are connected to circuit components
    const voltmeters = this.components.filter((c) => c.type === "voltmeter");
    for (const voltmeter of voltmeters) {
      if (voltmeter.originalComponent) {
        // Check if voltmeter terminals are connected to other components
        const isConnected = this.isVoltmeterConnected(voltmeter);
        voltmeter.originalComponent.voltage = isConnected && isComplete ? measurements.voltage : 0;
      }
    }

    console.log(`[Graph] Circuit is ${isComplete ? "COMPLETE" : "OPEN"}`);
    console.log(
      `[Graph] ${bulbs.length} bulb(s) turned ${isComplete ? "ON" : "OFF"}`
    );
    console.log(`[Graph] Measurements: ${measurements.current.toFixed(2)}A, ${measurements.voltage.toFixed(2)}V`);

    if (hasSwitch && anySwitchOff) {
      console.log("[Graph] Circuit OPEN due to switch being OFF");
      console.log(`[Graph] ${bulbs.length} bulb(s) turned OFF`);
      return { status: -2, paths: [] };
    }

    console.log("[Graph] Circuit OPEN (no complete path)");
    console.log(`[Graph] ${bulbs.length} bulb(s) turned OFF`);
    return { status: 0, paths: [] };
  }
}

export { CircuitGraph };
