let chip;
let scaleFunc;
let sizeScale;

const Mode = {
  TOPOLOGY: 0,
  QUBIT: 1,
  COUPLER: 2,
};
let mode = Mode.TOPOLOGY;

const workQubitColor = "rgb(0, 122, 255)";
const disabledColor = "rgb(237, 231, 216)";
const selectedColor = "rgb(245, 91, 91)";
const workCouplerColor = "rgb(0, 0, 0)";
const textColor = "rgb(255, 255, 255)";
const diameterScale = 2 / 3;

function setup() {
  let canvasDiv = document.getElementById("chipCanvas");
  let canvas = createCanvas(canvasDiv.offsetWidth, canvasDiv.offsetHeight);
  canvas.parent("chipCanvas");
  setup_mode();

  copyButton = createButton("Copy Selected Qubits");
  let canvasPosition = canvasDiv.getBoundingClientRect();
  let buttonX = canvasPosition.left + canvasDiv.offsetWidth - 100; // Adjust position as needed
  let buttonY = canvasPosition.top + 10; // Adjust position as needed
  copyButton.position(buttonX, buttonY);
  copyButton.mousePressed(copySelectedQubits);

  copyCouplerButton = createButton("Copy Selected Couplers");
  let button2X = canvasPosition.left + canvasDiv.offsetWidth - 100; // Adjust position as needed
  let button2Y = canvasPosition.top + 40; // Adjust position as needed
  copyCouplerButton.position(button2X, button2Y);
  copyCouplerButton.mousePressed(copySelectedCouplers);

  initializeChip();
}

function setup_mode() {
  const modeSelectTopologyRadio = document.getElementById("modeSelectTopology");
  const modeSelectQubitRadio = document.getElementById("modeSelectQubit");
  const modeSelectCouplerRadio = document.getElementById("modeSelectCoupler");

  if (modeSelectTopologyRadio.checked) {
    mode = Mode.TOPOLOGY;
  } else if (modeSelectQubitRadio.checked) {
    mode = Mode.QUBIT;
  } else {
    mode = Mode.COUPLER;
  }
  modeSelectTopologyRadio.addEventListener("change", () => {
    if (modeSelectTopologyRadio.checked) {
      mode = Mode.TOPOLOGY;
      chip.reset_selected_qubits();
      chip.reset_selected_couplers();
    }
  });
  modeSelectQubitRadio.addEventListener("change", () => {
    if (modeSelectQubitRadio.checked) {
      mode = Mode.QUBIT;
      chip.reset_selected_couplers();
    }
  });
  modeSelectCouplerRadio.addEventListener("change", () => {
    if (modeSelectCouplerRadio.checked) {
      mode = Mode.COUPLER;
      chip.reset_selected_qubits();
    }
  });
}

function draw() {
  background(255);
  if (chip) {
    // Draw couplers first to ensure they're under the qubits
    chip.couplers.forEach((coupler) => {
      let color = getCouplerColor(coupler);
      coupler.display(color, scaleFunc);
    });

    // Draw qubits
    chip.qubits.forEach((qubit) => {
      let color = getQubitColor(qubit);
      qubit.display(color, scaleFunc);
    });
  }

  displayStats();
}

function getQubitColor(qubit) {
  if (qubit.disabled) {
    return disabledColor;
  } else if (qubit.selected) {
    return selectedColor;
  }
  return workQubitColor;
}

function getCouplerColor(coupler) {
  if (coupler.disabled) {
    return disabledColor;
  } else if (coupler.selected) {
    return selectedColor;
  }
  return workCouplerColor;
}

function initializeChip() {
  const chipWidth = parseInt(document.getElementById("chipWidth").value);
  const chipHeight = parseInt(document.getElementById("chipHeight").value);
  const qubitStartIdx = parseInt(
    document.getElementById("qubitStartIndex").value
  );
  const useOriginAsQubit = document.getElementById("useOriginAsQubit").checked;
  const qubitNameLength = parseInt(
    document.getElementById("qubitNameLength").value
  );

  chip = makeChip(
    chipWidth,
    chipHeight,
    useOriginAsQubit,
    qubitStartIdx,
    qubitNameLength
  );

  const chip_center = chip.center();
  const canvas_center = [width / 2, height / 2];

  let width_ratio = (3 * width) / 4 / chipWidth / 2;
  let height_ratio = (3 * height) / 4 / chipHeight;
  let ratio = Math.min(width_ratio, height_ratio);

  scaleFunc = (x, y) => {
    let scaled_x = (x - chip_center[0]) * ratio + canvas_center[0];
    let scaled_y = (y - chip_center[1]) * ratio + canvas_center[1];
    return [scaled_x, scaled_y];
  };

  let spacing = [
    scaleFunc(1, 1)[0] - scaleFunc(0, 0)[0],
    scaleFunc(1, 1)[1] - scaleFunc(0, 0)[1],
  ];
  sizeScale = Math.min(spacing[0], spacing[1]);
}

function mouseClicked() {
  if (mode === Mode.TOPOLOGY) {
    // disable/enable qubit
    for (let qubit of chip.qubits) {
      if (isClickOnQubit(qubit)) {
        qubit.disabled = !qubit.disabled;
        return;
      }
    }
    // disable/enable coupler
    for (let coupler of chip.couplers) {
      if (isClickOnCoupler(coupler)) {
        coupler.disabled = !coupler.disabled;
        return;
      }
    }
  } else if (mode === Mode.QUBIT) {
    for (let qubit of chip.qubits) {
      if (isClickOnQubit(qubit)) {
        qubit.selected = !qubit.selected;
        return;
      }
    }
  } else {
    for (let coupler of chip.couplers) {
      if (isClickOnCoupler(coupler)) {
        coupler.selected = !coupler.selected;
        return;
      }
    }
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
  }
}

function isClickOnQubit(qubit) {
  let [x, y] = scaleFunc(qubit.x, qubit.y);
  return dist(mouseX, mouseY, x, y) < (sizeScale * diameterScale) / 2;
}

function isClickOnCoupler(coupler) {
  let [x1, y1] = scaleFunc(coupler.qubitA.x, coupler.qubitA.y);
  let [x2, y2] = scaleFunc(coupler.qubitB.x, coupler.qubitB.y);
  return distToLine(mouseX, mouseY, x1, y1, x2, y2) < 5;
}

function distToLine(px, py, x1, y1, x2, y2) {
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

function displayStats() {
  const margin = 10;
  const statsTextSize = 14;
  const statsBoxWidth = 150;
  const statsBoxHeight = 100;
  const statsBoxX = margin;
  const statsBoxY = margin;
  const statsBoxColor = "rgba(255, 255, 255, 0.7)";

  const numWorkQubits = chip.functionalQubits().length;
  const numWorkCouplers = chip.functionalCouplers().length;

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
    `Active Qubits: ${numWorkQubits}`,
    statsBoxX + margin,
    statsBoxY + margin
  );
  text(
    `Active Couplers: ${numWorkCouplers}`,
    statsBoxX + margin,
    statsBoxY + margin * 2 + statsTextSize
  );
  text(
    `Selected Qubits: ${chip.selectedQubits().length}`,
    statsBoxX + margin,
    statsBoxY + margin * 3 + statsTextSize * 2
  );
  text(
    `Selected Couplers: ${chip.selectedCouplers().length}`,
    statsBoxX + margin,
    statsBoxY + margin * 4 + statsTextSize * 3
  );
}

function copySelectedQubits() {
  // Get selected qubits' names
  const selectedQubits = chip
    .selectedQubits()
    .map((qubit) => getQubitName(qubit.id, 3));

  // Generate Python list representation
  const pythonList =
    "[" + selectedQubits.map((name) => `'${name}'`).join(", ") + "]";

  // Copy to clipboard
  navigator.clipboard
    .writeText(pythonList)
    .then(() => {
      console.log("Python list copied to clipboard:", pythonList);
    })
    .catch((err) => {
      console.error("Unable to copy to clipboard:", err);
      alert("Unable to copy to clipboard!");
    });
}

function copySelectedCouplers() {
  let selectedCouplerNames = chip
    .selectedCouplers()
    .map((coupler) => `'${coupler.id}'`);
  let couplerListText = "[" + selectedCouplerNames.join(", ") + "]";

  navigator.clipboard
    .writeText(couplerListText)
    .then(() => {
      console.log("Selected couplers copied to clipboard:", couplerListText);
    })
    .catch((err) => {
      console.error("Failed to copy selected couplers to clipboard:", err);
    });
}

class Qubit {
  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.disabled = false;
    this.selected = false;
  }

  display(qubitColor, scaleFunc) {
    strokeWeight(2.5);
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
    this.disabled = false;
    this.selected = false;
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
    const meanX =
      this.qubits.reduce((acc, qubit) => acc + qubit.x, 0) / this.numQubits();
    const meanY =
      this.qubits.reduce((acc, qubit) => acc + qubit.y, 0) / this.numQubits();
    return [meanX, meanY];
  }

  numQubits() {
    return this.qubits.length;
  }

  numCouplers() {
    return this.couplers.length;
  }

  disabledQubits() {
    return this.qubits.filter((q) => q.disabled);
  }

  disabledCouplers() {
    return this.couplers.filter((c) => c.disabled);
  }

  functionalQubits() {
    return this.qubits.filter((q) => !q.disabled);
  }

  functionalCouplers() {
    return this.couplers.filter((c) => !c.disabled);
  }

  selectedQubits() {
    return this.qubits.filter((q) => q.selected);
  }

  selectedCouplers() {
    return this.couplers.filter((c) => c.selected);
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

  resetSelectedQubits() {
    this.qubits.forEach((q) => (q.selected = false));
  }

  resetSelectedCouplers() {
    this.couplers.forEach((c) => (c.selected = false));
  }
}

function makeChip(
  chip_width,
  chip_height,
  useOriginAsQubit,
  qubitStartIdx,
  qubitNameLength = 3
) {
  // qubits
  let qid = qubitStartIdx;
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
    for (let otherCoords of [
      [qubit.x - 1, qubit.y + 1],
      [qubit.x + 1, qubit.y + 1],
    ]) {
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
  return "Q" + qid.toString().padStart(qubitNameLength, "0");
}

function getCouplerName(qubitA, qubitB, qubitNameLength) {
  let q1 = getQubitName(qubitA.id, qubitNameLength);
  let q2 = getQubitName(qubitB.id, qubitNameLength);
  return q1 > q2
    ? "G" + q1.substring(1) + q2.substring(1)
    : "G" + q2.substring(1) + q1.substring(1);
}
