import Cell from "./Cell";
import { ExtrudeSettings, TilemapSettings, GridSettings } from "../utils/Interfaces";
import { Shape, BufferGeometry, ShapeGeometry, Vector3, Object3D, Material } from "three";
import Tile from "./Tile";
import HexGrid from './HexGrid';
import TM from '../tm';
import SqrGrid from "./SqrGrid";

export interface GridInterface {
  type: string;
  size: number;
  cellSize: number;
  cells: { [key: string]: Cell };
  numCells: number;
  extrudeSettings: ExtrudeSettings;
  cellShape: Shape;
  cellGeo: BufferGeometry;
  cellShapeGeo: ShapeGeometry;
  autogenerated: boolean;
   

  cellToPixel(cell: Cell): Vector3;
  add(cell: Cell): Cell;
  remove(cell: Cell): void;
  cellToHash(cell: Cell): string;
  pixelToCell(pos: Vector3): Cell;
  dispose(): void;
  generateOverlay(size: number, overlayObj: Object3D, overlayMat: Material): void;
  generateTilemap(tilemapSettings: TilemapSettings): Tile[];
  generateGrid(config: GridSettings): void;
  clearPath(): void;
  getNeighbors(cell: Cell, diagonals: boolean, heuristic: Function): Cell[];
  distance(cellA: Cell, cellB: Cell): number;
};

export default class Grid {
  constructor(config?: GridSettings) {
    if (config.type === undefined || config.type === TM.HEX) {
      return new HexGrid(config);
    } else if (config.type === TM.SQR) {
      return new SqrGrid(config);
    }
  }
}