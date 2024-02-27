const Mode = {
    TOPOLOGY: 0,
    QUBIT: 1,
    COUPLER: 2,
};
const Colors = {
    WORK_QUBIT: "rgb(0, 122, 255)",
    DISABLED: "rgb(237, 231, 216)",
    SELECTED: "rgb(245, 91, 91)",
    WORK_COUPLER: "rgb(0, 0, 0)",
    TEXT: "rgb(255, 255, 255)"
};
const diameterScale = 2 / 3;

let chip, scaleFunc, sizeScale, mode;
let dragStartX, dragStartY;
let dragging = false;
let selectionBox = { x: 0, y: 0, width: 0, height: 0 };


function setup() {
    initializeCanvas();
    setupModeListeners();
    initializeChip();
}

function draw() {
    background(255);
    chip?.draw();
    chip?.displayStats();
    draggingBox();
}

// Initialize the canvas and buttons
function initializeCanvas() {
    const canvasDiv = document.getElementById("chipCanvas");
    const canvas = createCanvas(canvasDiv.offsetWidth, canvasDiv.offsetHeight);
    canvas.parent("chipCanvas");
    createControlButtons(canvasDiv);
}

// Setup event listeners for mode selection
function setupModeListeners() {
    setupModeSelector("modeSelectTopology", Mode.TOPOLOGY);
    setupModeSelector("modeSelectQubit", Mode.QUBIT);
    setupModeSelector("modeSelectCoupler", Mode.COUPLER);
}

// Chip Initialization
function initializeChip() {
    chip = new Chip(
        document.getElementById("chipWidth").value,
        document.getElementById("chipHeight").value,
        document.getElementById("useOriginAsQubit").checked,
        document.getElementById("qubitStartIndex").value,
        document.getElementById("qubitNameLength").value
    );
    setupScaling();
}

function draggingBox() {
    // Draw selection box
    if (dragging && (mode === Mode.QUBIT || mode === Mode.COUPLER)) {
        noFill();
        stroke(0);
        strokeWeight(1);
        rect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
    }

    selectionBox = { x: 0, y: 0, width: 0, height: 0 };
}

// Mouse interaction functions
function mouseClicked() { chip.handleClick(mouseX, mouseY, mode); }

function doubleClicked() { chip.handleDoubleClick(mouseX, mouseY, mode); }

function mousePressed() {
    if (mode === Mode.QUBIT || mode === Mode.COUPLER) {
        dragStartX = mouseX;
        dragStartY = mouseY;
        dragging = true;
    }
}

function mouseDragged() {
    if ((mode === Mode.QUBIT || mode === Mode.COUPLER) && dragging) {
        let minX = min(dragStartX, mouseX);
        let minY = min(dragStartY, mouseY);
        let maxX = max(dragStartX, mouseX);
        let maxY = max(dragStartY, mouseY);

        // Update selection box dimensions
        selectionBox.x = minX;
        selectionBox.y = minY;
        selectionBox.width = maxX - minX;
        selectionBox.height = maxY - minY;

        chip.handleDrag(minX, minY, maxX, maxY);
    }
}

function mouseReleased() {
    dragging = false;
}

class Qubit {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.disabled = false;
        this.selected = false;
    }

    draw() {
        stroke(0);
        strokeWeight(2.5);
        fill(this.disabled ? Colors.DISABLED : this.selected ? Colors.SELECTED : Colors.WORK_QUBIT);
        let [scaledX, scaledY] = scaleFunc(this.x, this.y);
        ellipse(scaledX, scaledY, sizeScale * diameterScale);
        fill(Colors.TEXT);
        textAlign(CENTER, CENTER);
        textSize(sizeScale / 3);
        text(this.id, scaledX, scaledY);
    }

    isClicked(x, y) {
        return dist(x, y, scaleFunc(this.x, this.y)[0], scaleFunc(this.x, this.y)[1]) < sizeScale * diameterScale / 2;
    }

    isSelected(minX, minY, maxX, maxY) {
        let [x, y] = scaleFunc(qubit.x, qubit.y);
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }

    getName(qubitNameLength) {
        return "Q" + this.id.toString().padStart(qubitNameLength, "0");
    }
}

class Coupler {
    constructor(qubitA, qubitB) {
        this.qubitA = qubitA;
        this.qubitB = qubitB;
        this.disabled = false;
        this.selected = false;
    }

    draw() {
        strokeWeight(5);
        stroke(this.disabled ? Colors.DISABLED : this.selected ? Colors.SELECTED : Colors.WORK_COUPLER);
        let [x1, y1] = scaleFunc(this.qubitA.x, this.qubitA.y);
        let [x2, y2] = scaleFunc(this.qubitB.x, this.qubitB.y);
        line(x1, y1, x2, y2);
    }

    isClicked(x, y) {
        let [x1, y1] = scaleFunc(this.qubitA.x, this.qubitA.y);
        let [x2, y2] = scaleFunc(this.qubitB.x, this.qubitB.y);
        return distToSegment(x, y, x1, y1, x2, y2) < 5;
    }

    isSelected(minX, minY, maxX, maxY) {
        let [x1, y1] = scaleFunc(this.qubitA.x, this.qubitA.y);
        let [x2, y2] = scaleFunc(this.qubitB.x, this.qubitB.y);
        return (
            (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) ||
            (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY)
        );
    }

    getName(qubitNameLength) {
        let q1 = this.qubitA.getName(qubitNameLength);
        let q2 = this.qubitB.getName(qubitNameLength);
        return q1 > q2
            ? "G" + q1.substring(1) + q2.substring(1)
            : "G" + q2.substring(1) + q1.substring(1);
    }
}

class Chip {
    constructor(width, height, useOriginAsQubit, qubitStartIdx, qubitNameLength) {
        this.width = parseInt(width);
        this.height = parseInt(height);
        [this.qubits, this.couplers] = this.initialize(useOriginAsQubit, qubitStartIdx);
        this.qubitNameLength = parseInt(qubitNameLength);
    }

    center() {
        let sumX = this.qubits.reduce((acc, qubit) => acc + qubit.x, 0);
        let sumY = this.qubits.reduce((acc, qubit) => acc + qubit.y, 0);
        return [sumX / this.numQubits(), sumY / this.numQubits()];
    }

    numQubits() {
        return this.qubits.length;
    }

    numCouplers() {
        return this.couplers.length;
    }

    numActiveQubits() {
        return this.qubits.filter((q) => !q.disabled).length;
    }

    numActiveCouplers() {
        return this.couplers.filter((c) => !c.disabled).length;
    }

    numSelectedQubits() {
        return this.qubits.filter((q) => q.selected).length;
    }

    numSelectedCouplers() {
        return this.couplers.filter((c) => c.selected).length;
    }

    deleteQubit(qubit) {
        this.qubits = this.qubits
            .filter((q) => q !== qubit)
            .map((q) => {
                if (q.id > qubit.id) {
                    q.id -= 1;
                }
                return q;
            });
        this.couplers = this.couplers.filter(
            (c) => c.qubitA !== qubit && c.qubitB !== qubit
        );
    }

    resetSelections() {
        this.qubits.forEach((q) => (q.selected = false));
        this.couplers.forEach((c) => (c.selected = false));
    }

    getSelectedQubitsPythonList() {
        return '[' + this.qubits
            .filter(qubit => qubit.selected)
            .map(qubit => `'${qubit.getName(this.qubitNameLength)}'`)
            .join(', ') + ']';
    }

    getSelectedCouplersPythonList() {
        return '[' + this.couplers
            .filter(coupler => coupler.selected)
            .map(coupler => `'${coupler.getName(this.qubitNameLength)}'`)
            .join(', ') + ']';
    }

    draw() {
        this.couplers.forEach(coupler => coupler.draw());
        this.qubits.forEach(qubit => qubit.draw());
    }

    handleClick(x, y, mode) {
        if (mode === Mode.TOPOLOGY || mode === Mode.QUBIT) {
            for (let qubit of chip.qubits) {
                if (qubit.isClicked(x, y)) {
                    if (mode === Mode.TOPOLOGY) qubit.disabled = !qubit.disabled;
                    if (mode === Mode.QUBIT) qubit.selected = !qubit.selected;
                    return;
                }
            }
        }
        if (mode === Mode.TOPOLOGY || mode === Mode.COUPLER) {
            for (let coupler of chip.couplers) {
                if (coupler.isClicked(x, y)) {
                    if (mode === Mode.TOPOLOGY) coupler.disabled = !coupler.disabled;
                    if (mode === Mode.COUPLER) coupler.selected = !coupler.selected;
                    return;
                }
            }
        }
    }

    handleDoubleClick(x, y, mode) {
        if (mode === Mode.TOPOLOGY) {
            this.qubits.forEach(qubit => {
                if (qubit.isClicked(x, y)) {
                    this.deleteQubit(qubit);
                }
            })
        }
    }

    handleDrag(minX, minY, maxX, maxY) {
        if (mode === Mode.QUBIT) {
            for (let qubit of this.qubits) {
                if (qubit.isSelected(minX, minY, maxX, maxY)) {
                    qubit.selected = true;
                }
            }
        } else {
            for (let coupler of this.couplers) {
                if (coupler.isSelected(minX, minY, maxX, maxY)) {
                    coupler.selected = true;
                }
            }
        }
    }

    initialize(useOriginAsQubit, qubitStartIdx) {
        let qubits = [];
        let qubitDict = {};
        let qid = parseInt(qubitStartIdx);

        for (let y = 0; y < this.height; y++) {
            let even_row = y % 2 === 0;
            let rowOffset = even_row == useOriginAsQubit ? 0 : 1;
            for (let x = 0; x < this.width - (rowOffset ? 1 : 0); x++) {
                let posX = x * 2 + rowOffset;
                let posY = y * 1;
                let qubit = new Qubit(qid, posX, posY);
                qubits.push(qubit);
                qubitDict[[posX, posY]] = qubit;
                qid += 1;
            }
        }

        // couplers
        let couplers = [];
        for (let qubit of qubits) {
            for (let otherCoords of [
                [qubit.x - 1, qubit.y + 1],
                [qubit.x + 1, qubit.y + 1],
            ]) {
                if (otherCoords in qubitDict) {
                    let otherQubit = qubitDict[otherCoords];
                    let coupler = new Coupler(qubit, otherQubit);
                    couplers.push(coupler);
                }
            }
        }
        return [qubits, couplers];
    }

    displayStats() {
        const margin = 10;
        const statsTextSize = 14;
        const statsBoxWidth = 160;
        const statsBoxHeight = 100;
        const statsBoxX = margin;
        const statsBoxY = margin;
        const statsBoxColor = "rgba(255, 255, 255, 0.7)";

        const numActiveQubits = this.numActiveQubits();
        const numActiveCouplers = this.numActiveCouplers();

        // Draw the stats box
        fill(statsBoxColor);
        stroke(0);
        rect(statsBoxX, statsBoxY, statsBoxWidth, statsBoxHeight, 10);

        // Display the number of work qubits and work couplers
        fill(0);
        textSize(statsTextSize);
        strokeWeight(1);
        textAlign(LEFT, TOP);
        text(
            `Active Qubits: ${numActiveQubits}`,
            statsBoxX + margin,
            statsBoxY + margin
        );
        text(
            `Active Couplers: ${numActiveCouplers}`,
            statsBoxX + margin,
            statsBoxY + margin * 2 + statsTextSize
        );
        text(
            `Selected Qubits: ${this.numSelectedQubits()}`,
            statsBoxX + margin,
            statsBoxY + margin * 3 + statsTextSize * 2
        );
        text(
            `Selected Couplers: ${this.numSelectedCouplers()}`,
            statsBoxX + margin,
            statsBoxY + margin * 4 + statsTextSize * 3
        );
    }

}

// Create control buttons and position them
function createControlButtons(canvasDiv) {
    const canvasPosition = canvasDiv.getBoundingClientRect();
    createButtonAt("Copy Selected Qubits", canvasPosition.left + canvasDiv.offsetWidth - 160, canvasPosition.top + 10, copySelectedQubits);
    createButtonAt("Copy Selected Couplers", canvasPosition.left + canvasDiv.offsetWidth - 160, canvasPosition.top + 40, copySelectedCouplers);
}

// Create a button at a specified position
function createButtonAt(label, x, y, callback) {
    const button = createButton(label);
    button.position(x, y);
    button.mousePressed(callback);
}

// Create a mode selector radio button listener
function setupModeSelector(elementId, modeValue) {
    const radioButton = document.getElementById(elementId);
    if (radioButton.checked) {
        mode = modeValue;
    }
    radioButton.addEventListener("change", () => {
        if (radioButton.checked) {
            mode = modeValue;
            chip.resetSelections();
        }
    });
}

// Setup scaling function based on chip and canvas size
function setupScaling() {
    const chipCenter = chip.center();
    const canvasCenter = [width / 2, height / 2];
    const widthRatio = (3 * width) / 4 / chip.width / 2;
    const heightRatio = (3 * height) / 4 / chip.height;
    const ratio = Math.min(widthRatio, heightRatio);

    scaleFunc = (x, y) => {
        return [
            (x - chipCenter[0]) * ratio + canvasCenter[0],
            (y - chipCenter[1]) * ratio + canvasCenter[1]
        ];
    };

    const spacing = [
        scaleFunc(1, 1)[0] - scaleFunc(0, 0)[0],
        scaleFunc(1, 1)[1] - scaleFunc(0, 0)[1]
    ];
    sizeScale = Math.min(spacing[0], spacing[1]);
}

// Clipboard copy functions
function copySelectedQubits() {
    navigator.clipboard.writeText(
        chip.getSelectedQubitsPythonList()
    )
        .then(() => console.log("Python list copied to clipboard"))
        .catch(err => console.error("Unable to copy to clipboard:", err));
}

function copySelectedCouplers() {
    navigator.clipboard.writeText(
        chip.getSelectedCouplersPythonList()
    )
        .then(() => console.log("Selected couplers copied to clipboard"))
        .catch(err => console.error("Failed to copy selected couplers to clipboard:", err));
}

function distToSegment(px, py, x1, y1, x2, y2) {
    let dx = x2 - x1;
    let dy = y2 - y1;
    let len_sq = dx * dx + dy * dy;

    let t = ((px - x1) * dx + (py - y1) * dy) / len_sq;
    t = Math.max(0, Math.min(1, t)); // Clamp t to ensure it's within the line segment

    let nearestX = x1 + t * dx;
    let nearestY = y1 + t * dy;

    let distSq =
        (px - nearestX) * (px - nearestX) + (py - nearestY) * (py - nearestY);
    return Math.sqrt(distSq);
}
