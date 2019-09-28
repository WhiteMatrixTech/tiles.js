/* eslint-disable */
import React from 'react';
import TM from '../lib/tm.ts';
import * as dat from 'dat.gui';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand, faCompress } from '@fortawesome/free-solid-svg-icons';
import './dat.css';

export default class Sandbox extends React.Component {
  params = {
    cameraControl: {
      controlled: true,
      enableDamping: true,
      dampingFactor: 0.05,
      minDistance: 25,
      maxDistance: 150,
      zoomSpeed: 3,
      hotEdges: true,
      autoRotate: false,
      screenSpacePanning: false,
      minPolarAngle: Math.PI / 6,
      maxPolarAngle: Math.PI / 3,
      minAzimuthAngle: 0,
      maxAzimuthAngle: -Math.PI,
      horizontalRotation: false
    }
  };
  state = {
    fullscreen: false
  }
  componentDidMount() {
    const cc = this.params.cameraControl;
    this.scene = new TM.Scene({
      element: document.getElementById('view'),
      cameraPosition: { x: 0, y: 40, z: 50 },
      cameraControlSettings: {
        controlled: cc.controlled,
        enableDamping: cc.enableDamping,
        dampingFactor: cc.dampingFactor,
        maxDistance: cc.maxDistance,
        minDistance: cc.minDistance,
        enableZoom: cc.enableZoom,
        zoomSpeed: cc.zoomSpeed,
        hotEdges: cc.hotEdges,
        autoRotate: cc.autoRotate,
        screenSpacePanning: cc.screenSpacePanning,
        minPolarAngle: cc.minPolarAngle,
        maxPolarAngle: cc.maxPolarAngle,
        maxAzimuthAngle: cc.maxAzimuthAngle,
        minAzimuthAngle: cc.minAzimuthAngle,
        horizontalRotation: cc.horizontalRotation
      }
    });
    this.mouse = new TM.MouseCaster(this.scene.container, this.scene.camera);

    // this constructs the cells in grid coordinate space
    this.gridSpace = new TM.Grid({
      cellSize: 5,
      gridSize: 75
    });
    this.board = new TM.Board(this.gridSpace);

    // this will generate extruded hexagonal tiles
    this.board.generateTilemap({
      tileScale: 0.965 // you might have to scale the tile so the extruded geometry fits the cell size perfectly
    });
    this.board.generateTerrain();
    //this.board.generateOverlay(45);
    this.board.group.rotation.y = Math.PI / 2;
    this.scene.add(this.board.group);
    this.scene.focusOn(this.board.group);

    this.mouse.signal.add(function(evt, tile) {
      if (evt === TM.MouseCaster.CLICK) {
        //tile.toggle();
        console.log(tile.position);
        // or we can use the mouse's raw coordinates to access the cell directly, just for fun:
        //const cell = this.board.grid.pixelToCell(this.mouse.position);
        //const t = this.board.getTileAtCell(cell);
        //if (t) t.toggle();
      }
    }, this);

    const gui = new dat.GUI({ autoPlace: false });
    document.getElementById('gui').append(gui.domElement);
    const camGUI = gui.addFolder('Camera');
    camGUI
      .add(this.scene.camera.position, 'x')
      .step(10)
      .listen();
    camGUI
      .add(this.scene.camera.position, 'y')
      .step(10)
      .listen();
    camGUI
      .add(this.scene.camera.position, 'z')
      .step(10)
      .listen();
    const orbitControls = camGUI.addFolder('Control');
    orbitControls
      .add(cc, 'controlled')
      .name('Enabled')
      .onChange(() => {
        this.scene.toggleControls();
      });
    orbitControls
      .add(cc, 'enableDamping')
      .name('Damping')
      .onChange(val => {
        this.scene.updateControls({ enableDamping: val });
      });
    orbitControls
      .add(cc, 'dampingFactor', 0, 1)
      .step(0.01)
      .name('Damping Factor')
      .onChange(val => {
        this.scene.updateControls({ dampingFactor: val });
      });
    orbitControls
      .add(cc, 'maxDistance', 0, 1000)
      .step(10)
      .name('Max Zoom Out')
      .onChange(val => {
        this.scene.updateControls({ maxDistance: val });
      });
    orbitControls
      .add(cc, 'minDistance', 0, 1000)
      .step(10)
      .name('Max Zoom In')
      .onChange(val => {
        this.scene.updateControls({ minDistance: val });
      });
    orbitControls
      .add(cc, 'zoomSpeed', 0, 20)
      .step(1)
      .name('Zoom Speed')
      .onChange(val => {
        this.scene.updateControls({ zoomSpeed: val });
      });
    orbitControls
      .add(cc, 'hotEdges')
      .name('Edge Scroll')
      .onChange(val => {
        this.scene.updateControls({ hotEdges: val });
      });
    orbitControls
      .add(cc, 'autoRotate')
      .name('Auto Rotate')
      .onChange(val => {
        this.scene.updateControls({ autoRotate: val });

        if (val === true) {
          cc.horizontalRotation = true;
        } else {
          cc.horizontalRotation = false;
        }
      });
    orbitControls
      .add(cc, 'screenSpacePanning')
      .name('Screen Space Panning')
      .onChange(val => {
        this.scene.updateControls({ screenSpacePanning: val });
      });
    orbitControls
      .add(cc, 'minPolarAngle', 0, 180)
      .step(1)
      .name('Min Polar Angle')
      .onChange(val => {
        val = (val * Math.PI) / 180;
        this.scene.updateControls({ minPolarAngle: val });
      });
    orbitControls
      .add(cc, 'maxPolarAngle', 0, 180)
      .step(1)
      .name('Max Polar Angle')
      .onChange(val => {
        val = (val * Math.PI) / 180;
        this.scene.updateControls({ minPolarAngle: val });
      });
    orbitControls
      .add(cc, 'minAzimuthAngle', -180, 180)
      .step(1)
      .name('Min Azimuth Angle')
      .onChange(val => {
        val = (val * Math.PI) / 180;
        this.scene.updateControls({ minAzimuthAngle: val });
      });
    orbitControls
      .add(cc, 'maxAzimuthAngle', -180, 180)
      .step(1)
      .name('Max Azimuth Angle')
      .onChange(val => {
        val = (val * Math.PI) / 180;
        this.scene.updateControls({ maxAzimuthAngle: val });
      });
    orbitControls
      .add(cc, 'horizontalRotation')
      .name('Hor. Rotation')
      .onChange(val => {
        this.scene.toggleHorizontalRotation(val);
      })
      .listen();
    const worldGUI = gui.addFolder('World');
    worldGUI.addFolder('Grid/Board');
    worldGUI.addFolder('Terrain');
    camGUI.open();
    orbitControls.open();

    this.update();
  }
  update() {
    this.mouse.update();
    this.scene.render();
    this.animID = requestAnimationFrame(() => {
      this.update();
    });
  }
  componentWillUnmount() {
    window.cancelAnimationFrame(this.animID);
    this.scene.dispose();
    this.gridSpace.dispose();
    delete this.board;
    delete this.gridSpace;
    delete this.scene;
  }
  toggleFullscreen() {
    let elem = document.querySelector('.App');

    if (!document.fullscreenElement) {
      elem.requestFullscreen().then(() => {
        this.setState({ fullscreen: true });
      }).catch(err => {
        alert(
          `Error attempting to enable full-screen mode: ${err.message} (${err.name})`
        );
      });
    } else {
      document.exitFullscreen().then(() => {
        this.setState({ fullscreen: false });
      });
    }
  }
  render() {
    let toggle;
    if (!document.fullscreenElement) {
      toggle = <FontAwesomeIcon icon={faExpand} size="4x" />;
    } else {
      toggle = <FontAwesomeIcon icon={faCompress} size="4x" />;
    }
    return (
      <div className="App">
        <div id="gui"></div>
        <button className='fullScreenToggle' onClick={() => this.toggleFullscreen()}>{toggle}</button>
        <div id="view"></div>
      </div>
    );
  }
}