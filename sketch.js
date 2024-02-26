let chip;
let scaleFunc;
let sizeScale;

const Mode = {
    TOPOLOGY: 0,
    SELECT: 1,
}
let mode = Mode.TOPOLOGY;

const workQubitColor = 'rgb(0, 122, 255)';
const disabledQubitColor = 'rgb(255, 0, 0)';
const workCouplerColor = 'rgb(0, 0, 0)';
const disabledCouplerColor = 'rgb(255, 0, 0)';
const textColor = 'rgb(255, 255, 255)';
const diameterScale = 2 / 3;


function setup() {
    let canvasDiv = document.getElementById('chipCanvas');
    let canvas = createCanvas(canvasDiv.offsetWidth, canvasDiv.offsetHeight);
    canvas.parent('chipCanvas');

    const modeTopologyRadio = document.getElementById('modeTopology');
    const modeSelectRadio = document.getElementById('modeSelect');

    mode = modeTopologyRadio.checked ? Mode.TOPOLOGY : Mode.SELECT;

    modeTopologyRadio.addEventListener('change', () => {
        if (modeTopologyRadio.checked) {
            mode = Mode.TOPOLOGY;
        }
    });

    modeSelectRadio.addEventListener('change', () => {
        if (modeSelectRadio.checked) {
            mode = Mode.SELECT;
        }
    });

    initializeChip();
}

function draw() {
    background(255);
    if (chip) {
        // Draw couplers first to ensure they're under the qubits
        chip.couplers.forEach(coupler => {
            let color = coupler.disabled ? disabledCouplerColor : workCouplerColor;
            coupler.display(color, scaleFunc);
        });

        // Draw qubits
        strokeWeight(2.5);
        chip.qubits.forEach(qubit => {
            let color = qubit.disabled ? disabledQubitColor : workQubitColor;
            qubit.display(color, scaleFunc);
        });
    }
}

function initializeChip() {
    const chipWidth = parseInt(document.getElementById('chipWidth').value);
    const chipHeight = parseInt(document.getElementById('chipHeight').value);
    const useOriginAsQubit = document.getElementById('useOriginAsQubit').checked;
    const qubitNameLength = parseInt(document.getElementById('qubitNameLength').value);

    chip = make_chip(chipWidth, chipHeight, useOriginAsQubit, qubitNameLength);

    const chip_center = chip.center();
    const canvas_center = [width / 2, height / 2];

    let width_ratio = 3 * width / 4 / chipWidth / 2;
    let height_ratio = 3 * height / 4 / chipHeight;
    let ratio = Math.min(width_ratio, height_ratio);


    scaleFunc = (x, y) => {
        let scaled_x = (x - chip_center[0]) * ratio + canvas_center[0];
        let scaled_y = (y - chip_center[1]) * ratio + canvas_center[1];
        return [scaled_x, scaled_y];
    };

    let spacing = [scaleFunc(1, 1)[0] - scaleFunc(0, 0)[0], scaleFunc(1, 1)[1] - scaleFunc(0, 0)[1]];
    sizeScale = Math.min(spacing[0], spacing[1]);
}

function mouseClicked() {
    console.log('mouse clicked');
    if (mode === Mode.TOPOLOGY) {
        // disable/enable qubit
        for (let qubit of chip.qubits) {
            let [x, y] = scaleFunc(qubit.x, qubit.y);
            if (isClickOnQubit(qubit)) {
                qubit.disabled = !qubit.disabled;
                return;
            }
        }
        // disable/enable coupler
        for (let coupler of chip.couplers) {
            let [x1, y1] = scaleFunc(coupler.qubitA.x, coupler.qubitA.y);
            let [x2, y2] = scaleFunc(coupler.qubitB.x, coupler.qubitB.y);
            if (distToLine(mouseX, mouseY, x1, y1, x2, y2) < 2) {
                coupler.disabled = !coupler.disabled;
                return;
            }
        };
    }
}

function doubleClicked() {
    if (mode === Mode.SELECT) {
        return;
    }
    for (let qubit of chip.qubits) {
        if (isClickOnQubit(qubit)) {
            chip.delete_qubit(qubit);
            return;
        }
    };
}

function isClickOnQubit(qubit) {
    let [x, y] = scaleFunc(qubit.x, qubit.y);
    return dist(mouseX, mouseY, x, y) < sizeScale * diameterScale / 2;
}

function distToLine(px, py, x1, y1, x2, y2) {
    let dx = x2 - x1;
    let dy = y2 - y1;
    let len_sq = dx * dx + dy * dy;

    let t = ((px - x1) * dx + (py - y1) * dy) / len_sq;
    t = Math.max(0, Math.min(1, t)); // Clamp t to ensure it's within the line segment

    let nearestX = x1 + t * dx;
    let nearestY = y1 + t * dy;

    let distSq = (px - nearestX) * (px - nearestX) + (py - nearestY) * (py - nearestY);
    return Math.sqrt(distSq);
}

class Qubit {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.disabled = false;
    }

    display(qubitColor, scaleFunc) {
        fill(qubitColor);
        let [x, y] = scaleFunc(this.x, this.y);
        ellipse(x, y, sizeScale * diameterScale);
        fill(textColor);
        textAlign(CENTER, CENTER);
        textSize(sizeScale / 3);
        text(this.id, x, y);
    }

    isSamePos(qubit) {
        return this.x === qubit.x && this.y === qubit.y;
    }
}

class Coupler {
    constructor(id, qubitA, qubitB) {
        this.id = id;
        this.qubitA = qubitA;
        this.qubitB = qubitB;
    }

    display(couplerColor, scaleFunc) {
        strokeWeight(5);
        stroke(couplerColor);
        let [x1, y1] = scaleFunc(this.qubitA.x, this.qubitA.y);
        let [x2, y2] = scaleFunc(this.qubitB.x, this.qubitB.y);
        line(x1, y1, x2, y2);
    }
}

class Chip {
    constructor(qubits, couplers) {
        this.qubits = qubits;
        this.couplers = couplers;
    }

    center() {
        const meanX = this.qubits.reduce((acc, qubit) => acc + qubit.x, 0) / this.num_qubits();
        const meanY = this.qubits.reduce((acc, qubit) => acc + qubit.y, 0) / this.num_qubits();
        return [meanX, meanY];
    }

    num_qubits() {
        return this.qubits.length;
    }

    num_couplers() {
        return this.couplers.length;
    }

    disabled_qubits() {
        return this.qubits.filter(q => q.disabled);
    }

    disabled_couplers() {
        return this.couplers.filter(c => c.disabled);
    }

    functional_qubits() {
        return this.qubits.filter(q => !q.disabled);
    }

    functional_couplers() {
        return this.couplers.filter(c => !c.disabled);
    }

    delete_qubit(qubit) {
        this.qubits = this.qubits.filter(q => q !== qubit).map(q => {
            if (q.id > qubit.id) {
                q.id -= 1;
            }
            return q;
        });
        this.couplers = this.couplers.filter(c => c.qubitA !== qubit && c.qubitB !== qubit);
    }
}

function make_chip(chip_width, chip_height, useOriginAsQubit, qubitNameLength = 3) {
    // qubits
    let qid = 0;
    let qubits = [];
    let qubitDict = {};
    for (let y = 0; y < chip_height; y++) {
        let even_row = y % 2 === 0;
        let rowOffset = even_row == useOriginAsQubit ? 0 : 1;
        for (let x = 0; x < chip_width - (rowOffset ? 1 : 0); x++) {
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
        for (let otherCoords of [[qubit.x - 1, qubit.y + 1], [qubit.x + 1, qubit.y + 1]]) {
            if (otherCoords in qubitDict) {
                otherQubit = qubitDict[otherCoords];
                let coupler_id = getCouplerName(qubit, otherQubit, qubitNameLength);
                let coupler = new Coupler(coupler_id, qubit, otherQubit);
                couplers.push(coupler);
            }
        }
    }

    let chip = new Chip(qubits, couplers);
    return chip;
}

function getQubitName(qid, qubitNameLength) {
    return "Q" + qid.toString().padStart(qubitNameLength, '0');
}

function getCouplerName(qubitA, qubitB, qubitNameLength) {
    let q1 = getQubitName(qubitA.id, qubitNameLength);
    let q2 = getQubitName(qubitB.id, qubitNameLength);
    return q1 > q2 ? 'G' + q1.substring(1) + q2.substring(1) : 'G' + q2.substring(1) + q1.substring(1);
}
