import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GPUComputationRenderer } from 'three/examples/jsm/Addons.js';


import fragment from "./shader/fragment.glsl"
import fragmentSimulation from "./shader/fragmentSimulation.glsl"
import vertex from "./shader/vertexParticles.glsl"
import * as dat from "dat.gui";
import gsap from "gsap";
import face from './brain4.glb';

// Texture width determines particles
const WIDTH = 128;



export default class Sketch{
    constructor(options){      
        this.scene = new THREE.Scene();

        this.container = options.dom;
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
        this.renderer.setSize( this.width, this.height );
        this.renderer.setClearColor(0xeeeeee,1);
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        this.container.appendChild(this.renderer.domElement);
        this.loader = new GLTFLoader();

        this.camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.001,
            1000
        )

        
        this.camera.position.set(0,0,2);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.time = 0;

        this.loader.load(face,(gltf)=>{
            console.log(gltf.scene.children[0].children[0].children[0].children[0].children[0].children[0]);
            
            this.model = gltf.scene.children[0].children[0].children[0].children[0].children[0].children[0];
            this.model.geometry.scale(.02,.02,.02);
            this.model.geometry.translate(0,-.5,0);
            this.model.geometry.rotateY(-Math.PI/2);
            

            this.facePos = this.model.geometry.attributes.position.array;
            this.faceNumber = this.facePos.length/3;
            console.log(this.facePos);

            this.isPlaying = true;    
            this.initGPGPU();    
            this.addObjects();
            this.resize();
            this.render();
            this.setupResize();


        })



    }

    initGPGPU() {
        this.gpuCompute = new GPUComputationRenderer(WIDTH,WIDTH,this.renderer);
        this.dtPosition = this.gpuCompute.createTexture();
        //console.log(this.dtPosition);
        this.fillPositions(this.dtPosition);

        this.positionVariable = this.gpuCompute.addVariable('texturePosition',
            fragmentSimulation, this.dtPosition);

        //console.log(this.gpuCompute)

        this.positionVariable.material.uniforms['time'] = {value: 0};

        this.positionVariable.wrapS = THREE.RepeatWrapping;
        this.positionVariable.wrapT = THREE.RepeatWrapping;
        this.gpuCompute.init();

    }

    fillPositions(texture) {
        let arr = texture.image.data;
        for (let i = 0; i < arr.length; i=i+4) {

            let rand = Math.floor(Math.random()*this.faceNumber)
            // let x = Math.random();
            // let y = Math.random();
            // let z = Math.random();

            let x = this.facePos[3*rand];
            let y = this.facePos[3*rand+1];
            let z = this.facePos[3*rand+2];

            arr[i] = x;
            arr[i+1] = y;
            arr[i+2] = z;
            arr[i+3] = 1;

        }
    }

    settings() {
        let that = this;
        this.settings = {
            progress: 0,
        };
        this.gui = new dat.GUI();
        this.gui.add(this.settings, "progress", 0,1,0.01);
    }

    setupResize() {
        window.addEventListener("resize", this.resize.bind(this));
    }

    resize() {
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;
        this.renderer.setSize(this.width, this.height);
        this.camera.aspect = this.width / this.height;

        

        this.camera.updateProjectionMatrix();
    }


    addObjects() {
        let that = this;
        this.material = new THREE.ShaderMaterial({
            extensions: {
                derivatives: "#extension GL_OES_standard_derivatives : enable"
            },
            side: THREE.DoubleSide,
            uniforms: {
                time: {value: 0 },
                positionTexture: { value: null },
                resolution: {value: new THREE.Vector4()},
            },
            vertexShader: vertex,
            fragmentShader: fragment
        });

        this.geometry = new THREE.BufferGeometry();
        let positions = new Float32Array(WIDTH*WIDTH*3);
        let reference = new Float32Array(WIDTH*WIDTH*2);
        for (let i = 0; i < WIDTH*WIDTH; i++) {
            let x = Math.random();
            let y = Math.random();
            let z = Math.random();
            let xx = (i%WIDTH)/WIDTH;
            let yy = ~~(i/WIDTH)/WIDTH;
            positions.set([x,y,z],i*3)
            reference.set([xx,yy],i*2)
        }

        this.geometry.setAttribute('position', 
            new THREE.BufferAttribute(positions,3))
        this.geometry.setAttribute('reference', 
            new THREE.BufferAttribute(reference,2))
        
        // Use brain model:
        // this.geometry = this.model.geometry;

        // Use sphere:
        // this.geometry = new THREE.IcosahedronGeometry(1.,136);

        // Use box:
        // this.geometry = new THREE.BoxGeometry(1.3,1.3,1.3,80.,80.,80.);
        // this.geometry.rotateY(-Math.PI/4);

        // Use torus
        this.geometry = new THREE.TorusGeometry(.8,0.4,300,600,Math.PI*2);
        this.geometry.rotateX(Math.PI/1.5);
        this.geometry.translate(1.5,-0.2,0);
        this.plane = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.plane)
    }

    stop() {
        this.isPlaying = false;

    }

    play() {
        if(!this.isPlaying) {
            this.render()
            this.isPlaying = true;
        }
    }


    render() {
        if(!this.isPlaying) return;
        this.time += 0.05;

        this.positionVariable.material.uniforms['time'].value = this.time;

        this.gpuCompute.compute();
        this.material.uniforms.positionTexture.value = this.gpuCompute.getCurrentRenderTarget(
            this.positionVariable).texture;

        this.material.uniforms.time.value = this.time;

        
        requestAnimationFrame(this.render.bind(this));
        this.renderer.render(this.scene, this.camera);
    }    
}

new Sketch({
    dom: document.getElementById("container")
});


    
