import Engine from '../Engine';
import {
  Shape,
  BufferGeometry,
  ShapeGeometry,
  Vector3,
  Geometry,
  ExtrudeGeometry,
  Object3D,
  Material,
  Line,
} from 'three';
import { GridInterface } from './Grid';
import { GridSettings, ExtrudeSettings, MapSettings, GridJSONData, TileSettings, heuristic } from '../utils/Interfaces';
import Cell from './Cell';
import Tile from './Tile';

/*
	Graph of hexagons. Handles grid cell management (placement math for eg pathfinding, range, etc) and grid conversion math.
	[Cube/axial coordinate system](http://www.redblobgames.com/grids/hexagons/), "flat top" version only. Since this is 3D, just rotate your camera for pointy top maps.
 */
// 'utils/Loader', 'graphs/Hex', 'utils/Tools'
export default class HexGrid implements GridInterface {

  // Interface
  public gridShape: string;
  public gridSize: number;
  public cellSize: number;

  
  public cells: { [key: string]: Cell };
  public numCells: number;
  public autogenerated: boolean;

  public extrudeSettings: ExtrudeSettings;
  // Hex Specific
  public cellShape: Shape;
  public cellGeo: BufferGeometry;
  public cellShapeGeo: ShapeGeometry;
  public _cellWidth: number;
  public _cellLength: number;
  
  // Internals
  private _hashDelimeter: string;
  private _directions: Cell[];
  private _diagonals: Cell[];
  private _list: Cell[];
  private  _vec3: Vector3;
  private _cel: Cell;
  private _geoCache: Geometry[];
  private _matCache: Material[];

  public static get TWO_THIRDS(): number { return 2 / 3};

  constructor(config?: GridSettings) {
    let settings = {
      gridShape: Engine.HEX,
      gridSize: 10,
      cellSize: 10,
      cellShape: Engine.HEX,
    } as GridSettings;
    if (config)
      settings = Engine.Tools.merge(settings, config) as GridSettings

    this.gridShape = settings.gridShape;
    this.gridSize = settings.gridSize;
    this.cellSize = settings.cellSize;

    // Generate cells
    this.cells = {};
    this.numCells = 0;

    this.extrudeSettings = null;
    this.autogenerated = false;

    // create base shape used for building geometry
    let i;
    const verts = [];
    // create the skeleton of the hex
    for (i = 0; i < 6; i++) {
      verts.push(this._createVertex(i));
    }
    // copy the verts into a shape for the geometry to use
    this.cellShape = new Shape();
    this.cellShape.moveTo(verts[0].x, verts[0].y);
    for (i = 1; i < 6; i++) {
      this.cellShape.lineTo(verts[i].x, verts[i].y);
    }
    this.cellShape.lineTo(verts[0].x, verts[0].y);
    this.cellShape.autoClose = true;

    this.cellGeo = new BufferGeometry();
    (this.cellGeo as any).vertices = verts;
    (this.cellGeo as any).verticesNeedUpdate = true;

    this.cellShapeGeo = new ShapeGeometry(this.cellShape);

    /*  ______________________________________________
      PRIVATE
    */

    this._cellWidth = this.cellSize * 2;
    this._cellLength = (Engine.SQRT3 * 0.5) * this._cellWidth;
    this._hashDelimeter = '.';
    // pre-computed permutations
    this._directions = [new Cell(+1, -1, 0), new Cell(+1, 0, -1), new Cell(0, +1, -1),
    new Cell(-1, +1, 0), new Cell(-1, 0, +1), new Cell(0, -1, +1)];
    this._diagonals = [new Cell(+2, -1, -1), new Cell(+1, +1, -2), new Cell(-1, +2, -1),
    new Cell(-2, +1, +1), new Cell(-1, -1, +2), new Cell(+1, -2, +1)];
    // cached objects
    this._list = [];
    this._vec3 = new Vector3();
    this._cel = new Cell();
    this._geoCache = [];
    this._matCache = [];

    this.generateGrid(settings);
  }
  /*  ________________________________________________________________________
		High-level functions that the map interfaces with (all grids implement)
	 */

  // grid cell (Hex in cube coordinate space) to position in pixels/world
  cellToPixel(cell: Cell): Vector3 {
    this._vec3.x = cell.q * this._cellWidth * 0.75;
    this._vec3.y = cell.h;
    this._vec3.z = -((cell.s - cell.r) * this._cellLength * 0.5);
    return this._vec3;
  }

  pixelToCell(pos: Vector3): Cell {
    // convert a position in world space ("pixels") to cell coordinates
    const q = pos.x * (HexGrid.TWO_THIRDS / this.cellSize);
    const r = ((-pos.x / 3) + (Engine.SQRT3 / 3) * pos.z) / this.cellSize;
    this._cel.set(q, r, -q - r);
    return this._cubeRound(this._cel);
  }

  getCellAt(pos: Vector3): Cell {
    // get the Cell (if any) at the passed world position
    const q = pos.x * (HexGrid.TWO_THIRDS / this.cellSize);
    const r = ((-pos.x / 3) + (Engine.SQRT3 / 3) * pos.z) / this.cellSize;
    this._cel.set(q, r, -q - r);
    this._cubeRound(this._cel);
    return this.cells[this.cellToHash(this._cel)];
  }

  getNeighbors(cell: Cell, diagonal?: boolean, filter?: heuristic): Cell[] {
    // always returns an array
    let i, n;
    const l = this._directions.length;
    this._list.length = 0;
    for (i = 0; i < l; i++) {
      this._cel.copy(cell);
      this._cel.add(this._directions[i]);
      n = this.cells[this.cellToHash(this._cel)];
      if (!n || (filter && !filter(cell, n))) {
        continue;
      }
      this._list.push(n);
    }
    if (diagonal == null || diagonal === true) {
      for (i = 0; i < l; i++) {
        this._cel.copy(cell);
        this._cel.add(this._diagonals[i]);
        n = this.cells[this.cellToHash(this._cel)];
        if (!n || (filter && !filter(cell, n))) {
          continue;
        }
        this._list.push(n);
      }
    }
    return this._list;
  }

  getRandomCell(): Cell {
    let c;
    let i = 0;
    const x = Engine.Tools.randomInt(0, this.numCells);
    for (c in this.cells) {
      if (i === x) {
        return this.cells[c];
      }
      i++;
    }
    return this.cells[c];
  }

  cellToHash(cell: Cell): string {
    return cell.q + this._hashDelimeter + cell.r + this._hashDelimeter + cell.s;
  }

  distance(cellA: Cell, cellB: Cell): number {
    let d = Math.max(Math.abs(cellA.q - cellB.q), Math.abs(cellA.r - cellB.r), Math.abs(cellA.s - cellB.s));
    d += cellB.h - cellA.h; // include vertical height
    return d;
  }

  clearPath(): void {
    let i, c;
    for (i in this.cells) {
      c = this.cells[i];
      c.resetPath();
    }
  }

  traverse(cb: (cell: Cell) => void): void {
    let i;
    for (i in this.cells) {
      cb(this.cells[i]);
    }
  }

  generateTile(cell: Cell, scale: number, material: Material): Tile {
    let height = Math.abs(cell.h);
    if (height < 1) height = 1;

    let geo = this._geoCache[height];
    if (!geo) {
      this.extrudeSettings.amount = height;
      geo = new ExtrudeGeometry(this.cellShape, this.extrudeSettings);
      this._geoCache[height] = geo;
    }

		/*mat = this._matCache[c.matConfig.mat_cache_id];
		if (!mat) { // MaterialLoader? we currently only support basic stuff though. maybe later
			mat.map = Loader.loadTexture(c.matConfig.imgURL);
			delete c.matConfig.imgURL;
			mat = new THREE[c.matConfig.type](c.matConfig);
			this._matCache[c.matConfig.mat_cache_id] = mat;
		}*/

    const tile = new Tile({
      //size: this.cellSize,
      scale: scale,
      cell: cell,
      geometry: geo,
      material: material
    } as TileSettings);

    // const nx = cell.q / this._cellWidth - 0.5, ny = cell.s / (this as HexGrid)._cellLength - 0.5;
    // let e = (1.00 * Engine.Tools.noise1(1 * nx, 1 * ny)
    //   + 0.50 * Engine.Tools.noise1(2 * nx, 2 * ny)
    //   + 0.25 * Engine.Tools.noise1(4 * nx, 4 * ny)
    //   + 0.13 * Engine.Tools.noise1(8 * nx, 8 * ny)
    //   + 0.06 * Engine.Tools.noise1(16 * nx, 16 * ny)
    //   + 0.03 * Engine.Tools.noise1(32 * nx, 32 * ny));
    // e /= (1.00 + 0.50 + 0.25 + 0.13 + 0.06 + 0.03);
    // e = Math.pow(e, 5.00);
    // let m = (1.00 * Engine.Tools.noise2(1 * nx, 1 * ny)
    //   + 0.75 * Engine.Tools.noise2(2 * nx, 2 * ny)
    //   + 0.33 * Engine.Tools.noise2(4 * nx, 4 * ny)
    //   + 0.33 * Engine.Tools.noise2(8 * nx, 8 * ny)
    //   + 0.33 * Engine.Tools.noise2(16 * nx, 16 * ny)
    //   + 0.50 * Engine.Tools.noise2(32 * nx, 32 * ny));
    // m /= (1.00 + 0.75 + 0.33 + 0.33 + 0.33 + 0.50);
    // tile.setTerrain(e, m);
    tile.setType(cell.userData?.type ?? 'default');

    cell.tile = tile;

    return tile;
  }

  generateTiles(config?: MapSettings): Tile[] {
    config = config || {} as MapSettings;
    const tiles = [];
    let settings = {
      tileScale: 0.95,
      extrudeSettings: {
        amount: 10,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.5,
        bevelThickness: 0.5
      } as ExtrudeSettings
    } as MapSettings;
    if(config)
      settings = Engine.Tools.merge(settings, config) as MapSettings;

    this.autogenerated = true;
    this.extrudeSettings = settings.extrudeSettings;

    let i, t, c;
    for (i in this.cells) {
      c = this.cells[i];
      t = this.generateTile(c, settings.tileScale, settings.material);
      t.position.copy(this.cellToPixel(c));
      t.position.y = 0;
      tiles.push(t);
    }
    return tiles;
  }

  // create a flat grid IN VIRTUAL SPACE (NO TILES JUST COORDINATES)
  generateGrid(config?: GridSettings): void {
    this.gridSize = typeof config.gridSize === 'undefined' ? this.gridSize : config.gridSize;
    this.gridShape = typeof config.gridShape === 'undefined' ? this.gridShape : config.gridShape;
    let c;
    if (this.gridShape === Engine.RCT) {
      for (let q = -this.gridSize; q < this.gridSize; q++) {
        const rOffset = q >> 1; // or r>>1
        for (let r = -rOffset; r < this.gridSize - rOffset; r++) {
          c = new Cell(q, r, -q - r);
          this.add(c);
        }
      }
    } else if (this.gridShape === Engine.HEX) {
      /* HEX SHAPED GRID */
      let x, y, z;
      for (x = -this.gridSize; x < this.gridSize + 1; x++) {
        for (y = -this.gridSize; y < this.gridSize + 1; y++) {
          z = -x - y;
          if (Math.abs(x) <= this.gridSize && Math.abs(y) <= this.gridSize && Math.abs(z) <= this.gridSize) {
            c = new Cell(x, y, z);
            this.add(c);
          }
        }
      }
    }
  }

  generateOverlay(size: number, overlayObj: Object3D, overlayMat: Material): void {
    let x, y, z;
    const geo = this.cellShape.createPointsGeometry(6);
    for (x = -size; x < size + 1; x++) {
      for (y = -size; y < size + 1; y++) {
        z = -x - y;
        if (Math.abs(x) <= size && Math.abs(y) <= size && Math.abs(z) <= size) {
          this._cel.set(x, y, z); // define the cell
          const line = new Line(geo, overlayMat);
          line.position.copy(this.cellToPixel(this._cel));
          line.rotation.x = 90 * Engine.DEG_TO_RAD;
          overlayObj.add(line);
        }
      }
    }
    overlayObj.position.y = .5;
  }

  add(cell: Cell): Cell {
    const h = this.cellToHash(cell);
    if (this.cells[h]) {
      // console.warn('A cell already exists there');
      return;
    }
    this.cells[h] = cell;
    this.numCells++;

    return cell;
  }

  remove(cell: Cell): Cell {
    const h = this.cellToHash(cell);
    if (this.cells[h]) {
      delete this.cells[h];
      this.numCells--;
    }
    return cell;
  }

  dispose(): void {
    this.cells = null;
    this.numCells = 0;
    this.cellShape = null;
    this.cellGeo.dispose();
    this.cellGeo = null;
    this.cellShapeGeo.dispose();
    this.cellShapeGeo = null;
    this._list = null;
    this._vec3 = null;
    this._geoCache = null;
    this._matCache = null;
  }

	/*
		Load a grid from a parsed json object.
		json = {
			extrudeSettings,
			size,
			cellSize,
			autogenerated,
			cells: [],
			materials: [
				{
					cache_id: 0,
					type: 'MeshLambertMaterial',
					color, ambient, emissive, reflectivity, refractionRatio, wrapAround,
					imgURL: url
				}
				{
					cacheId: 1, ...
				}
				...
			]
		}
	*/
  load(url: string, cb: Function, scope: any): void {
    const self = this;
    Engine.Tools.getJSON({
      url: url,
      callback: function (json: GridJSONData) {
        self.fromJSON(json);
        cb.call(scope || null, json);
      },
      cache: false,
      scope: self
    });
  }

  fromJSON(json: GridJSONData): void {
    let i, c;
    const cells =  json.cells;

    this.cells = {};
    this.numCells = 0;

    this.gridSize = json.size;
    this.cellSize = json.cellSize;
    this._cellWidth = this.cellSize * 2;
    this._cellLength = (Engine.SQRT3 * 0.5) * this._cellWidth;

    this.extrudeSettings = json.extrudeSettings;
    this.autogenerated = json.autogenerated;
    
    for (i = 0; i < cells.length; i++) {
      c = new Cell();
      c.copy(cells[i]);
      this.add(c);
    }
  }

  toJSON(): GridJSONData {
    const json = {
      size: this.gridSize,
      cellSize: this.cellSize,
      extrudeSettings: this.extrudeSettings,
      autogenerated: this.autogenerated,
      cells: null,
    } as GridJSONData;
    const cells = [] as Cell[];
    let c, k;

    for (k in this.cells) {
      c = this.cells[k];
      cells.push({
        q: c.q,
        r: c.r,
        s: c.s,
        h: c.h,
        walkable: c.walkable,
        userData: c.userData
      } as Cell);
    }
    json.cells = cells;

    return json;
  }

	/*  ________________________________________________________________________
		Hexagon-specific conversion math
		Mostly commented out because they're inlined whenever possible to increase performance.
		They're still here for reference.
	 */

  _createVertex(i: number): Vector3 {
    const angle = (Engine.TAU / 6) * i;
    return new Vector3((this.cellSize * Math.cos(angle)), (this.cellSize * Math.sin(angle)), 0);
  }

	/*_pixelToAxial: function(pos) {
		var q, r; // = x, y
		q = pos.x * ((2/3) / this.cellSize);
		r = ((-pos.x / 3) + (Engine.SQRT3/3) * pos.y) / this.cellSize;
		this._cel.set(q, r, -q-r);
		return this._cubeRound(this._cel);
	}*/

	/*_axialToCube: function(h) {
		return {
			q: h.q,
			r: h.r,
			s: -h.q - h.r
		};
	}*/

	/*_cubeToAxial: function(cell) {
		return cell; // yep
	}*/

	/*_axialToPixel: function(cell) {
		var x, y; // = q, r
		x = cell.q * this._cellWidth * 0.75;
		y = (cell.s - cell.r) * this._cellLength * 0.5;
		return {x: x, y: -y};
	}*/

	/*_hexToPixel: function(h) {
		var x, y; // = q, r
		x = this.cellSize * 1.5 * h.x;
		y = this.cellSize * Engine.SQRT3 * (h.y + (h.x * 0.5));
		return {x: x, y: y};
	}*/

	/*_axialRound: function(h) {
		return this._cubeRound(this.axialToCube(h));
	}*/

  _cubeRound(h: Cell): Cell {
    let rx = Math.round(h.q);
    let ry = Math.round(h.r);
    let rz = Math.round(h.s);

    const xDiff = Math.abs(rx - h.q);
    const yDiff = Math.abs(ry - h.r);
    const zDiff = Math.abs(rz - h.s);

    if (xDiff > yDiff && xDiff > zDiff) {
      rx = -ry - rz;
    }
    else if (yDiff > zDiff) {
      ry = -rx - rz;
    }
    else {
      rz = -rx - ry;
    }

    return this._cel.set(rx, ry, rz);
  }

	/*_cubeDistance: function(a, b) {
		return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
	}*/
}