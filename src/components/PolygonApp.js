export default class PolygonApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.isPanning = false;
    this.startX = 0;
    this.startY = 0;
    this.draggingPolygon = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    this.colors = ["red"];

    this.shadowRoot.innerHTML = `
                    <style>
                        :host {
                            display: flex;
                            flex-direction: column;
                            width: 100%;
                            height: 100%;
                            background: rgba(25, 25, 35, 0.8);
                            border-radius: 15px;
                            overflow: hidden;
                        }
                        
                        .zone {
                            border: 2px dashed rgba(255, 255, 255, 0.2);
                            border-radius: 10px;
                            padding: 15px;
                            margin: 15px;
                            position: relative;
                            box-sizing: border-box;
                        }
                        
                        .zone-header {
                            position: absolute;
                            top: 0;
                            left: 50%;
                            transform: translateX(-50%);
                            background: rgba(0, 0, 0, 0.7);
                            color: white;
                            padding: 5px 20px;
                            border-radius: 0 0 10px 10px;
                            font-size: 1.1rem;
                            z-index: 10;
                        }
                        
                        .buffer-zone {
                            height: 20%; /* Увеличено пространство для рабочей зоны */
                            display: flex;
                            flex-wrap: wrap;
                            gap: 15px;
                            align-items: center;
                            justify-content: center;
                            background: rgba(20, 30, 48, 0.6);
                            overflow: auto;
                        }
                        
                        .workspace-zone {
                            height: 80%; /* Увеличено пространство для рабочей зоны */
                            background: rgba(15, 23, 42, 0.7);
                            overflow: hidden;
                            position: relative;
                            padding-bottom: 45px;
                        }
                        
                        .polygon-container {
                            width: 80px;
                            height: 80px;
                            cursor: move;
                            transition: transform 0.2s ease;
                        }
                        
                        .polygon-container:hover {
                            transform: scale(1.1);
                        }
                        
                        .polygon-container svg {
                            width: 100%;
                            height: 100%;
                            filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.3));
                        }
                        
                        #workspace-svg {
                            width: 100%;
                            height: 100%;
                            background: rgba(10, 15, 30, 0.5);
                        }
                        
                        #viewport {
                            transform-origin: 0 0;
                        }
                        
                        .axis {
                            stroke: rgba(255, 255, 255, 0.6);
                            stroke-width: 1.5;
                        }
                        
                        .grid-line {
                            stroke: rgba(255, 255, 255, 0.15);
                            stroke-width: 0.8;
                        }
                        
                        .axis-label {
                            fill: rgba(255, 255, 255, 0.8);
                            font-size: 12px;
                            user-select: none;
                            font-family: Arial, sans-serif;
                        }
                        
                        .scale-info {
                            position: absolute;
                            bottom: 15px;
                            right: 15px;
                            background: rgba(0, 0, 0, 0.6);
                            color: white;
                            padding: 5px 10px;
                            border-radius: 5px;
                            font-size: 14px;
                        }
                        
                        .origin-marker {
                            fill: #ff5252;
                            r: 3;
                        }
                        
                        .workspace-polygon {
                            cursor: move;
                        }
                    </style>
                    
                    <div class="buffer-zone zone">
                        <div class="zone-header">Буферная зона</div>
                    </div>
                    
                    <div class="workspace-zone zone">
                        <div class="zone-header">Рабочая зона</div>
                        <svg id="workspace-svg">
                            <rect width="100%" height="100%" fill="rgba(10, 15, 30, 0.5)"></rect>
                            <g id="viewport"></g>
                            <g id="axes"></g>
                        </svg>
                    </div>
                `;

    this.bufferZone = this.shadowRoot.querySelector(".buffer-zone");
    this.workspaceZone = this.shadowRoot.querySelector(".workspace-zone");
    this.workspaceSvg = this.shadowRoot.querySelector("#workspace-svg");
    this.viewport = this.shadowRoot.querySelector("#viewport");
    this.axes = this.shadowRoot.querySelector("#axes");

    this.initEventListeners();
    this.loadState();
    this.updateAxes();
  }

  initEventListeners() {
    document
      .getElementById("createBtn")
      .addEventListener("click", () => this.createPolygons());
    document
      .getElementById("saveBtn")
      .addEventListener("click", () => this.saveState());
    document
      .getElementById("resetBtn")
      .addEventListener("click", () => this.resetState());

    this.workspaceSvg.addEventListener("wheel", this.handleWheel.bind(this));
    this.workspaceSvg.addEventListener("mousedown", this.startPan.bind(this));
    this.workspaceSvg.addEventListener("mousemove", this.handlePan.bind(this));
    this.workspaceSvg.addEventListener("mouseup", this.endPan.bind(this));
    this.workspaceSvg.addEventListener("mouseleave", this.endPan.bind(this));

    this.bufferZone.addEventListener(
      "dragover",
      this.handleDragOver.bind(this)
    );
    this.bufferZone.addEventListener("drop", this.handleBufferDrop.bind(this));

    this.workspaceZone.addEventListener(
      "dragover",
      this.handleDragOver.bind(this)
    );
    this.workspaceZone.addEventListener(
      "drop",
      this.handleWorkspaceDrop.bind(this)
    );
  }

  createPolygons() {
    this.clearBufferZone();
    const count = Math.floor(Math.random() * 16) + 5;

    for (let i = 0; i < count; i++) {
      this.bufferZone.appendChild(this.generatePolygon());
    }
  }

  generatePolygon() {
    const container = document.createElement("div");
    container.className = "polygon-container";
    container.draggable = true;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");

    const polygon = document.createElementNS(svgNS, "polygon");
    const vertices = Math.floor(Math.random() * 5) + 3;
    const points = [];

    for (let i = 0; i < vertices; i++) {
      const angle = (i / vertices) * Math.PI * 2;
      const radius = 30 + Math.random() * 20;
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius;
      points.push(`${x},${y}`);
    }

    polygon.setAttribute("points", points.join(" "));
    polygon.setAttribute("fill", this.colors[0]);
    svg.appendChild(polygon);
    container.appendChild(svg);

    container.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData(
        "text/plain",
        JSON.stringify({
          type: "polygon",
          points: points,
          color: this.colors[0],
        })
      );
    });

    return container;
  }

  handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.max(0.2, Math.min(3, this.scale + delta));

    const rect = this.workspaceSvg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.translateX = x - (x - this.translateX) * (newScale / this.scale);
    this.translateY = y - (y - this.translateY) * (newScale / this.scale);
    this.scale = newScale;

    this.updateViewport();
  }

  startPan(e) {
    if (e.button === 0 && !e.target.closest(".workspace-polygon")) {
      this.isPanning = true;
      this.startX = e.clientX - this.translateX;
      this.startY = e.clientY - this.translateY;
      this.workspaceSvg.style.cursor = "grabbing";
    }
  }

  handlePan(e) {
    if (this.isPanning) {
      this.translateX = e.clientX - this.startX;
      this.translateY = e.clientY - this.startY;
      this.updateViewport();
    } else if (this.draggingPolygon) {
      const rect = this.workspaceSvg.getBoundingClientRect();
      const x = (e.clientX - rect.left - this.translateX) / this.scale;
      const y = (e.clientY - rect.top - this.translateY) / this.scale;

      const transformX = x - this.dragOffsetX;
      const transformY = y - this.dragOffsetY;

      this.draggingPolygon.setAttribute(
        "transform",
        `translate(${transformX}, ${transformY})`
      );
    }
  }

  endPan() {
    this.isPanning = false;
    this.draggingPolygon = null;
    this.workspaceSvg.style.cursor = "default";
  }

  updateViewport() {
    this.viewport.setAttribute(
      "transform",
      `
                    translate(${this.translateX}, ${this.translateY})
                    scale(${this.scale})
                `
    );

    this.updateAxes();
  }

  updateAxes() {
    const svgNS = "http://www.w3.org/2000/svg";
    this.axes.innerHTML = "";

    const width = this.workspaceSvg.clientWidth;
    const height = this.workspaceSvg.clientHeight;

    const xAxis = document.createElementNS(svgNS, "line");
    xAxis.setAttribute("class", "axis");
    xAxis.setAttribute("x1", "0");
    xAxis.setAttribute("y1", height - 50);
    xAxis.setAttribute("x2", width);
    xAxis.setAttribute("y2", height - 50);
    this.axes.appendChild(xAxis);

    const yAxis = document.createElementNS(svgNS, "line");
    yAxis.setAttribute("class", "axis");
    yAxis.setAttribute("x1", "0");
    yAxis.setAttribute("y1", "0");
    yAxis.setAttribute("x2", "0");
    yAxis.setAttribute("y2", height);
    this.axes.appendChild(yAxis);

    const origin = document.createElementNS(svgNS, "circle");
    origin.setAttribute("class", "origin-marker");
    origin.setAttribute("cx", "0");
    origin.setAttribute("cy", height - 50);
    this.axes.appendChild(origin);

    const step = 50 / this.scale;
    const stepsX = Math.ceil(width / step);
    const stepsY = Math.ceil(height / step);

    for (let i = 1; i < stepsY; i++) {
      const y = height - i * step - 50;

      const gridLine = document.createElementNS(svgNS, "line");
      gridLine.setAttribute("class", "grid-line");
      gridLine.setAttribute("x1", "0");
      gridLine.setAttribute("y1", y);
      gridLine.setAttribute("x2", width);
      gridLine.setAttribute("y2", y);
      this.axes.appendChild(gridLine);

      if (i % 2 === 0 || this.scale > 1.5) {
        const labelLeft = document.createElementNS(svgNS, "text");
        labelLeft.setAttribute("class", "axis-label");
        labelLeft.setAttribute("x", "10");
        labelLeft.setAttribute("y", y - 5);
        labelLeft.textContent = Math.round(i * step);
        this.axes.appendChild(labelLeft);
      }
    }

    for (let i = 1; i < stepsX; i++) {
      const x = i * step;

      const gridLine = document.createElementNS(svgNS, "line");
      gridLine.setAttribute("class", "grid-line");
      gridLine.setAttribute("x1", x);
      gridLine.setAttribute("y1", "0");
      gridLine.setAttribute("x2", x);
      gridLine.setAttribute("y2", height);
      this.axes.appendChild(gridLine);

      if (i % 2 === 0 || this.scale > 1.5) {
        const labelBottom = document.createElementNS(svgNS, "text");
        labelBottom.setAttribute("class", "axis-label");
        labelBottom.setAttribute("x", x);
        labelBottom.setAttribute("y", height - 30);
        labelBottom.setAttribute("text-anchor", "middle");
        labelBottom.textContent = Math.round(x);
        this.axes.appendChild(labelBottom);
      }
    }

    const originLabel = document.createElementNS(svgNS, "text");
    originLabel.setAttribute("class", "axis-label");
    originLabel.setAttribute("x", 10);
    originLabel.setAttribute("y", height - 30);
    originLabel.textContent = "0";
    this.axes.appendChild(originLabel);
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  handleBufferDrop(e) {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData("text/plain"));

    if (data.type === "polygon") {
      this.bufferZone.appendChild(
        this.createWorkspacePolygon(data.points, data.color)
      );
    }
  }

  handleWorkspaceDrop(e) {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData("text/plain"));

    if (data.type === "polygon") {
      const polygon = this.createWorkspacePolygon(
        data.points,
        data.color,
        true
      );

      const rect = this.workspaceSvg.getBoundingClientRect();
      const x = (e.clientX - rect.left - this.translateX) / this.scale;
      const y = (e.clientY - rect.top - this.translateY) / this.scale;

      polygon.setAttribute("transform", `translate(${x - 50}, ${y - 50})`);
      this.viewport.appendChild(polygon);
    }
  }

  createWorkspacePolygon(points, color, isSvg = false) {
    const svgNS = "http://www.w3.org/2000/svg";

    if (isSvg) {
      const group = document.createElementNS(svgNS, "g");
      group.setAttribute("class", "workspace-polygon");
      group.draggable = true;

      const polygon = document.createElementNS(svgNS, "polygon");
      polygon.setAttribute("points", points.join(" "));
      polygon.setAttribute("fill", color);
      group.appendChild(polygon);

      group.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData(
          "text/plain",
          JSON.stringify({
            type: "polygon",
            points: points,
            color: color,
          })
        );
      });

      group.addEventListener("mousedown", (e) => {
        e.stopPropagation();

        let currentX = 0,
          currentY = 0;
        const transform = group.getAttribute("transform");

        if (transform) {
          const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
          if (match) {
            currentX = parseFloat(match[1]);
            currentY = parseFloat(match[2]);
          }
        }

        const rect = this.workspaceSvg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        this.dragOffsetX =
          (mouseX - this.translateX) / this.scale - currentX - 50;
        this.dragOffsetY =
          (mouseY - this.translateY) / this.scale - currentY - 50;
        this.draggingPolygon = group;
      });

      return group;
    } else {
      const container = document.createElement("div");
      container.className = "polygon-container";
      container.draggable = true;

      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 100 100");

      const polygon = document.createElementNS(svgNS, "polygon");
      polygon.setAttribute("points", points.join(" "));
      polygon.setAttribute("fill", color);
      svg.appendChild(polygon);
      container.appendChild(svg);

      container.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData(
          "text/plain",
          JSON.stringify({
            type: "polygon",
            points: points,
            color: color,
          })
        );
      });

      return container;
    }
  }

  saveState() {
    const state = {
      buffer: [],
      workspace: [],
      transform: {
        scale: this.scale,
        translateX: this.translateX,
        translateY: this.translateY,
      },
    };

    this.bufferZone
      .querySelectorAll(".polygon-container")
      .forEach((container) => {
        const svg = container.querySelector("svg");
        const polygon = svg.querySelector("polygon");
        state.buffer.push({
          points: polygon.getAttribute("points").split(" "),
          color: polygon.getAttribute("fill"),
        });
      });

    this.viewport.querySelectorAll("g").forEach((group) => {
      const polygon = group.querySelector("polygon");
      state.workspace.push({
        points: polygon.getAttribute("points").split(" "),
        color: polygon.getAttribute("fill"),
        transform: group.getAttribute("transform"),
      });
    });

    localStorage.setItem("polygonAppState", JSON.stringify(state));
    alert("Состояние успешно сохранено!");
  }

  loadState() {
    const state = JSON.parse(localStorage.getItem("polygonAppState"));
    if (!state) return;

    this.clearBufferZone();
    state.buffer.forEach((poly) => {
      this.bufferZone.appendChild(
        this.createWorkspacePolygon(poly.points, poly.color)
      );
    });

    this.viewport.innerHTML = "";
    state.workspace.forEach((poly) => {
      const polygon = this.createWorkspacePolygon(
        poly.points,
        poly.color,
        true
      );
      if (poly.transform) {
        polygon.setAttribute("transform", poly.transform);
      }
      this.viewport.appendChild(polygon);
    });

    this.scale = state.transform.scale;
    this.translateX = state.transform.translateX;
    this.translateY = state.transform.translateY;
    this.updateViewport();
  }

  resetState() {
    if (confirm("Вы уверены, что хотите сбросить все данные?")) {
      localStorage.removeItem("polygonAppState");
      this.clearBufferZone();
      this.viewport.innerHTML = "";
      this.scale = 1;
      this.translateX = 0;
      this.translateY = 0;
      this.updateViewport();
    }
  }

  clearBufferZone() {
    const containers = this.bufferZone.querySelectorAll(".polygon-container");
    containers.forEach((container) => container.remove());
  }
}

customElements.define("polygon-app", PolygonApp);
