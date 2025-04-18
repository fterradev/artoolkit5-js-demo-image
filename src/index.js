import 'reset-css';
import './css/style.css';

import * as THREE from 'three';
import ARToolkit from '@ar-js-org/artoolkit5-js';
import cameraConfig from './config';

let sourceVideo;
let targetCanvas;

// AR controller reference
let arc;

// internal HIRO marker ID
let markerId;

// used to render THREE.js scene
let renderer, scene, camera, markerRoot;

window.addEventListener("DOMContentLoaded", () => {

  initCamera(cameraConfig)
  .then(video => {

    // start camera playback
    sourceVideo = video;
    sourceVideo.width = cameraConfig.video.width;
    sourceVideo.height = cameraConfig.video.height;
    // sourceVideo.play();

    // init target canvas
    initTargetCanvas();

    // init THREE renderer
    initRenderer();

    return new Promise(resolve => {
      // sourceVideo.addEventListener("loadeddata", event => {
      //   console.log("Camera is ready");
      //   resolve();
      // });
      resolve();
    });
  })
  .then(_ => {
    return initAR();
  })
  .then(_ => {

    console.log("AR controller initialized");
    startProcessing();
    // setTimeout(startProcessing, 2000);
  });

});


// initializers
//------------------------------------------------------------------------------

async function initCamera(config) {

  const constraints = {
    audio: false,
    video: {
      //facingMode: "environment",
      facingMode: "user",
      width: config.video.width,
      height: config.video.height,
      frameRate: { max: config.video.fps }
    }
  };

  // initialize video source
  const video = document.querySelector("#sourcevideo");
  // const stream = await navigator.mediaDevices.getUserMedia(constraints);
  // video.srcObject = stream;

  return new Promise(resolve => {
    // video.onloadedmetadata = () => {
    //   resolve(video);
    // };
    resolve(video);
  });
};

async function initAR() {

  // init AR controller
  // Note: this camera_para.dat file works well for most built-in laptop webcams
  // It does NOT work very well for newer iPhone models (X / XS / 11)
  // The cube will be off quite a bit.
  // arc = await ARToolkit.ARController.initWithDimensions(
  //   cameraConfig.video.width, cameraConfig.video.height,
  //   '/data/camera_para.dat'
  // );
  arc = await ARToolkit.ARController.initWithImage(
    sourceVideo,
    '/data/camera_para.dat'
  );
  console.log("AR Controller initialized");

  // add HIRO marker
  markerId = await arc.artoolkit.addMarker(arc.id, '/data/hiro.patt');
  console.log("HIRO marker added with marker ID", markerId);
}

function initTargetCanvas() {
  // target canvas should overlap source video
  targetCanvas = document.querySelector("#targetcanvas");
  targetCanvas.width = sourceVideo.width;
  targetCanvas.height = sourceVideo.height;
}

function initRenderer() {

  // create a scene overlaying the video
  renderer = new THREE.WebGLRenderer({ canvas: targetCanvas, alpha: true });
  renderer.setSize(cameraConfig.video.width, cameraConfig.video.height);
  renderer.setClearColor(0xffffff, 0);
  renderer.autoClear = false;

  // init camera
  camera = new THREE.Camera();
  // camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );
  
  /*
  If matrixAutoUpdate is false, then we need to call camera.updateMatrix() after moving it.
  */
  // camera.matrixAutoUpdate = false;
  
  // camera.position.z = 1;

  scene = new THREE.Scene();
  scene.add(camera);

  const light1 = new THREE.PointLight(0xffffff);
  light1.position.set(400, 500, 100);
  scene.add(light1);
  const light2 = new THREE.PointLight(0xffffff);
  light2.position.set(-400, -500, -100);
  scene.add(light2);

  markerRoot = new THREE.Object3D();
  markerRoot.markerMatrix = new Float64Array(12);

  /*
  If false, we need to call updateMatrix later.
  But for some reason, if it's true, it won't get the AR transform.
  */
  markerRoot.matrixAutoUpdate = false;

  // create a simple cube
  // const cube = new THREE.Mesh(
  //   new THREE.BoxGeometry(1, 1, 1),
  //   new THREE.MeshLambertMaterial({ color: 0xffffff, wireframe: false })
  // );

  // // position the cube on top of the marker
  // cube.position.z = 0.5;

  // var pin = THREE.ImageUtils.loadTexture( '/images/brewer.png' );
  var pin = new THREE.TextureLoader().load('/images/brewer.png' );

  const geometry = new THREE.PlaneGeometry( 1, 1 );
  const material = new THREE.MeshBasicMaterial({ map: pin });
  // const material = new THREE.MeshLambertMaterial({ map: pin })
  const plane = new THREE.Mesh( geometry, material );

  // Use this to get a "default" view of the markerRoot
  // plane.position.z = -1;
  
  // Or this:
  markerRoot.position.z = -1;
  markerRoot.updateMatrix();

  // markerRoot.add(cube);
  markerRoot.add(plane);
  scene.add(markerRoot);  
}

// main detection loop
//------------------------------------------------------------------------------
function startProcessing() {

  const processFrame = () => {

    const result = arc.detectMarker(sourceVideo);
    if(result !== 0) {
      // ARToolkit returning a value !== 0 means an error occured
      console.log('Error detecting markers');
      return;
    }

    // get the total number of detected markers in frame
    const markerNum = arc.getMarkerNum();
    let hiroMarkerNum = false;

    // check if one of the detected markers is the HIRO marker
    for(let i = 0; i < markerNum; i++) {
      const markerInfo = arc.getMarker(i);
      if(markerInfo.idPatt == markerId) {
        // store the marker ID from the detection result
        hiroMarkerNum = i;
        break;
      }
    }

    console.log({markerNum});
    console.log({hiroMarkerNum});
    if(hiroMarkerNum !== false) {
      
      // HIRO marker found
      // if(markerRoot.visible) {
      //   arc.getTransMatSquareCont(
      //     hiroMarkerNum, 1, markerRoot.markerMatrix, markerRoot.markerMatrix
      //   );
      // } else {
      //   arc.getTransMatSquare(
      //     hiroMarkerNum /* Marker index */, 1 /* Marker width */, markerRoot.markerMatrix
      //   );
      // }

      arc.getTransMatSquare(
        hiroMarkerNum /* Marker index */, 1 /* Marker width */, markerRoot.markerMatrix
      );

      // show marker root
      markerRoot.visible = true;

      // position camera
      arc.arglCameraViewRHf(
        arc.transMatToGLMat(markerRoot.markerMatrix),
        markerRoot.matrix.elements
      );

      // markerRoot.matrix.elements = [0.8674437212769462, -0.06138414161301458, -0.49373411627680386, 0, -0.0019110548031015656, 0.9919415432598282, -0.12668197434855205, 0, 0.497531645512864, 0.11083303620198617, 0.8603361551158427, 0, -0.0805811349599389, -0.21148630540820565, -2.1353259754643057, 1];
      // markerRoot.matrix.elements = [1, -0, -0.5, 0, -0, 1, -0, 0, 0.5, 0, 1, 0, -0, -0, -2, 1];
      
      /*
      This is another way to get a "default" view of the markerRoot.
      (through a transformation matrix)
      */
      // markerRoot.matrix.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -2, 1];

      // The identity matrix
      // markerRoot.matrix.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

      console.log(markerRoot.matrix.elements);
      console.log(markerRoot);

    } else {

      // not found
      markerRoot.visible = false;
    }

    // render the scene
    renderer.clear();
    renderer.render(scene, camera);

    if (markerRoot.visible) {
      return;
    }

    // process next frame
    // window.requestAnimationFrame(processFrame);
  };


  // initialize camera projection matrix
  const cameraMatrix = arc.getCameraMatrix();
  camera.projectionMatrix.fromArray(cameraMatrix);

  processFrame();
}
