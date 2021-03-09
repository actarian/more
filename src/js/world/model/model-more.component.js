// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { environment } from '../../environment';
import LoaderService from '../../loader/loader.service';
import EmittableMesh from '../interactive/emittable.mesh';
import FreezableMesh from '../interactive/freezable.mesh';
import Interactive from '../interactive/interactive';
import InteractiveMesh from '../interactive/interactive.mesh';
import WorldComponent from '../world.component';
import ModelComponent from './model.component';
import { ParticlePoint } from './particle';

const SCALE = 2;
const BULGE_DISTANCE = 0.8;

const deg = (v) => v * Math.PI / 180;

export default class ModelMoreComponent extends ModelComponent {

	get freezed() {
		return this.freezed_;
	}
	set freezed(freezed) {
		if (this.freezed_ !== freezed) {
			this.freezed_ = freezed;
			const mesh = this.mesh;
			if (mesh) {
				mesh.traverse((child) => {
					if (child.isInteractiveMesh) {
						child.freezed = freezed;
					}
				});
			}
		}
	}

	onInit() {
		super.onInit();
		this.z = 0;
		this.progress = null;
		this.addListeners();
	}

	onDestroy() {
		this.removeListeners();
		super.onDestroy();
	}

	onCreate(mount, dismount) {
		this.loadGlb(environment.getPath('/models/'), 'more_logo2.glb', (mesh, animations) => {
			this.onGlbLoaded(mesh, animations, mount, dismount);
		});
	}

	loadGlb(path, file, callback) {
		const renderer = this.host.renderer;
		// const roughnessMipmapper = new RoughnessMipmapper(renderer); // optional
		const progressRef = LoaderService.getRef();
		// console.log('progressRef');
		const loader = new THREE.GLTFLoader().setPath(path);
		// Optional: Provide a DRACOLoader instance to decode compressed mesh data
		const decoderPath = `${environment.assets}js/draco/`;
		// console.log(decoderPath);
		const dracoLoader = new THREE.DRACOLoader();
		dracoLoader.setDecoderPath(decoderPath);
		loader.setDRACOLoader(dracoLoader);
		loader.load(file, (glb) => {
			/*
			glb.scene.traverse((child) => {
				if (child.isMesh) {
					// roughnessMipmapper.generateMipmaps(child.material);
				}
			});
			*/
			if (typeof callback === 'function') {
				callback(glb.scene, glb.animations);
			}
			LoaderService.setProgress(progressRef, 1);
		}, (progressEvent) => {
			LoaderService.setProgress(progressRef, progressEvent.loaded, progressEvent.total);
		});
	}

	parseAnimations(mesh, animations) {
		const actionIndex = this.actionIndex = -1;
		const actions = this.actions = [];
		if (animations && animations.length) {
			const clock = this.clock = new THREE.Clock();
			const mixer = this.mixer = new THREE.AnimationMixer(mesh);
			mixer.timeScale = 1;
			animations.forEach(animation => {
				const action = mixer.clipAction(animation);
				action.enabled = true;
				action.setEffectiveTimeScale(1);
				action.setEffectiveWeight(1);
				// action.setLoop(THREE.LoopPingPong);
				action.setLoop(THREE.LoopRepeat);
				// action.clampWhenFinished = true; // pause on last frame
				actions.push(action);
			});
		}
	}

	onClipToggle() {
		const actions = this.actions;
		if (actions.length === 1) {
			const action = actions[0];
			if (this.actionIndex === -1) {
				this.actionIndex = 0;
				if (action.paused || action.timeScale === 0) {
					action.paused = false;
				} else {
					action.play();
				}
			} else if (this.actionIndex === 0) {
				this.actionIndex = -1;
				action.halt(0.3);
			}
		} else if (actions.length > 1) {
			if (this.actionIndex > -1 && this.actionIndex < actions.length) {
				const previousClip = actions[this.actionIndex];
				previousClip.halt(0.3);
			}
			this.actionIndex++;
			if (this.actionIndex === actions.length) {
				this.actionIndex = -1;
				// nothing
			} else {
				const action = actions[this.actionIndex];
				// console.log(this.actionIndex, action);
				if (action.paused) {
					action.paused = false;
				}
				if (action.timeScale === 0) {
					action.timeScale = 1;
				}
				action.play();
			}
		}
	}

	onGlbLoaded(mesh, animations, mount, dismount) {
		// animations
		this.parseAnimations(mesh, animations);
		// scale
		const box = new THREE.Box3().setFromObject(mesh);
		const size = box.max.clone().sub(box.min);
		const max = Math.max(size.x, size.y, size.z);
		let scale = SCALE / max;
		mesh.scale.set(scale, scale, scale);
		// repos
		let dummy;
		dummy = new THREE.Group();
		dummy.add(mesh);

		const geometry = new THREE.PlaneGeometry(2, 2, 2, 2);
		const material = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide});
		const plane = this.plane = new THREE.Mesh( geometry, material );
		dummy.add(plane);

		/*
		box.setFromObject(dummy);
		const center = box.getCenter(new THREE.Vector3());
		const endY = 0; // dummy.position.y;
		const from = { tween: 1 };
		const onUpdate = () => {
			dummy.position.y = endY + 3 * from.tween;
			dummy.rotation.y = 0 + Math.PI * from.tween;
		};
		onUpdate();
		*/
		const particles = this.particles = this.getParticles(mesh, scale);
		dummy.add(particles);
		this.makeInteractive(plane);

		this.makeAnimation();
		/*
		gsap.to(from, {
			duration: 1.5,
			tween: 0,
			delay: 0.1,
			ease: Power2.easeInOut,
			onUpdate: onUpdate,
			onComplete: () => {
				console.log('complete', dummy.position.y);
			}
		});
		*/
		if (typeof mount === 'function') {
			mount(dummy);
		}
	}

	makeAnimation() {
		const animations = this.animations || (this.animations = [
			new THREE.Vector3(-deg(70), deg(20), 0),
			new THREE.Vector3(-deg(70), deg(-20), 0),
			new THREE.Vector3(-deg(70), deg(20), deg(45)),
			new THREE.Vector3(-deg(70), deg(-20), deg(-45)),
			new THREE.Vector3(0, 0, 0),
		]);
		const animationIndex = this.animationIndex != null ? this.animationIndex : (this.animationIndex = 0);
		const a = this.a != null ? this.a : (this.a = new THREE.Vector3());
		a.copy(animations[animationIndex]);
		this.animate();
	}

	animate() {
		setTimeout(() => {
			const a = this.a;
			const animations = this.animations;
			const animationIndex = (this.animationIndex + 1) % animations.length;
			this.animationIndex = animationIndex;
			const animation = animations[animationIndex];
			gsap.to(a, {
				x: animation.x,
				y: animation.y,
				z: animation.z,
				duration: 1,
				delay: 0.1,
				ease: Power2.easeInOut,
				onComplete: () => {
					this.animate();
				}
			});
		}, 4000);
	}

	render(time, tick) {
		const mesh = this.mesh;
		const group = this.group;
		const mixer = this.mixer;
		const clock = this.clock;
		const a = this.a;
		const z = this.z += deg(0.01);
		if (mesh) {
			const overing = this.getOvering();
			const state = this.state || (this.state = new THREE.Vector3(0, 0, 1));
			state.lerp(overing, 0.05);
			mesh.rotation.x = a.x + state.x;
			mesh.rotation.y = a.y + state.y;
			mesh.rotation.z = a.z + z;
			mesh.scale.x = state.z;
			mesh.scale.y = state.z;
			mesh.scale.z = state.z;
			// mesh.rotation.x += 0.001;
			// mesh.rotation.y += 0.001;
			const particles = this.particles;
			const particlePoints = this.particlePoints;
			if (particles && particlePoints && particlePoints.length) {
				const intersection = this.getIntersection();
				const intersectionPoint = intersection ? particles.worldToLocal(intersection.point) : null;
				particlePoints.forEach(x => x.render(intersectionPoint));
				const point = particlePoints[0];
				const positions = point.positions;
				const geometry = point.geometry;
				geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
				geometry.attributes.position.needsUpdate = true;
				// geometry.computeBoundingSphere();
			}
		}
		if (mixer) {
			const delta = clock.getDelta();
			mixer.update(delta);
		}
	}

	getIntersection() {
		/*
		if (this.plane.intersection) {
			return this.plane.intersection;
		}
		*/
		let intersection;
		this.mesh.traverse((child) => {
			if (child.isMesh && child.intersection) {
				intersection = child.intersection;
			}
		});
		return intersection;
	}

	getOvering() {
		const mouse = this.mouse || { x: 0, y: 0 };
		const overing = this.overing || new THREE.Vector3(0, 0, 1);
		if (this.over) {
			overing.x = -mouse.y * Math.PI / 180 * 80;
			overing.y = -mouse.x * Math.PI / 180 * 80;
			overing.z = 1.05;
		} else {
			overing.x = 0;
			overing.y = 0;
			overing.z = 1;
		}
		this.overing = overing;
		return overing;
	}

	static getInteractiveDescriptors() {
		let descriptors = ModelMoreComponent.interactiveDescriptors;
		if (!descriptors) {
			const freezableDescriptors = Object.getOwnPropertyDescriptors(FreezableMesh.prototype);
			const emittableDescriptors = Object.getOwnPropertyDescriptors(EmittableMesh.prototype);
			const interactiveDescriptors = Object.getOwnPropertyDescriptors(InteractiveMesh.prototype);
			descriptors = Object.assign({}, freezableDescriptors, emittableDescriptors, interactiveDescriptors);
			ModelMoreComponent.interactiveDescriptors = descriptors;
		}
		return descriptors;
	}

	makeInteractive(mesh) {
		const interactiveDescriptors = ModelMoreComponent.getInteractiveDescriptors();
		mesh.traverse((child) => {
			if (child.isMesh) {
				Object.keys(interactiveDescriptors).forEach(key => {
					if (key !== 'constructor') {
						Object.defineProperty(child, key, interactiveDescriptors[key]);
					}
				});
				child.freezed = false;
				child.events = {};
				child.depthTest = true;
				child.over_ = false;
				child.down_ = false;
				Interactive.items.push(child);
				child.on('over', () => {
					this.over = true;
				});
				child.on('out', () => {
					this.over = false;
				});
				child.on('down', () => {
					this.onClipToggle();
					console.log('onDown');
				});
			}
		});
	}

	getParticles(mesh, scale) {
		let target, targetMesh;
		mesh.traverse((child) => {
			if (child.isMesh) {
				child.material = new THREE.MeshBasicMaterial({ visible: false });
				targetMesh = child;
				target = child.geometry;
			}
		});
		const points = [];
		const vertexCount = targetMesh.geometry.getAttribute('position').count * 3;
		const sampler = new MeshSurfaceSampler(targetMesh)
			.setWeightAttribute(null)
			.build();
		// ; 'uv';
		const _position = new THREE.Vector3();
		const _normal = new THREE.Vector3();
		for (let i = 0; i < vertexCount; i++) {
			sampler.sample(_position, _normal);
			// _normal.add( _position );
			const point = new ParticlePoint(_position.clone().multiplyScalar(scale), i, vertexCount);
			points.push(point);
			// dummy.lookAt( _normal );
			// dummy.updateMatrix();
		}
		const amount = points.length;
		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(amount * 3);
		const colors = new Float32Array(amount * 3);
		const color = new THREE.Color();
		let n = 1, n2 = n / 2; // amount spread in the cube
		points.forEach((p, i) => {
			// positions
			positions[i * 3] = p.x;
			positions[i * 3 + 1] = p.y;
			positions[i * 3 + 2] = p.z;
			// colors
			/*
			const vx = (p.x / n) + 0.5;
			const vy = (p.y / n) + 0.5;
			const vz = (p.z / n) + 0.5;
			color.setRGB(vx, vy, vz);
			*/
			color.setRGB(113 / 255, 64 / 255, 253 / 255);
			colors[i * 3] = color.r;
			colors[i * 3 + 1] = color.g;
			colors[i * 3 + 2] = color.b;
			// point
			p.positions = positions;
			p.geometry = geometry;
		});
		this.particlePoints = points;
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		geometry.computeBoundingSphere();
		const texture = new THREE.CanvasTexture(this.getTexture());
		const material = new THREE.PointsMaterial({
			size: 0.01,
			map: texture,
			vertexColors: THREE.VertexColors,
			blending: THREE.NormalBlending, // THREE.NoBlending, // THREE.AdditiveBlending, // THREE.NormalBlending, // THREE.AdditiveBlending,
			depthTest: false,
			transparent: true
		});
		const particles = new THREE.Points(geometry, material);
		return particles;
	}

	onMove(event) {
		const mouse = this.mouse || { x: 0, y: 0 };
		if (event instanceof MouseEvent) {
			mouse.x = event.clientX;
			mouse.y = event.clientY;
		} else if (window.TouchEvent && event instanceof TouchEvent) {
			if (event.touches.length > 0) {
				mouse.x = event.touches[0].pageX;
				mouse.y = event.touches[0].pageY;
			}
		}
		const w2 = window.innerWidth / 2;
		const h2 = window.innerWidth / 2;
		mouse.x = (mouse.x - w2) / w2;
		mouse.y = (mouse.y - h2) / h2;
		// console.log(mouse.x, mouse.y);
		this.mouse = mouse;
	}

	getTexture() {
		let canvas = document.createElement('canvas');
		canvas.width = 64;
		canvas.height = 64;
		let ctx = canvas.getContext('2d');
		let gradient = ctx.createRadialGradient(
			canvas.width / 2,
			canvas.height / 2,
			0,
			canvas.width / 2,
			canvas.height / 2,
			canvas.width / 2
		);
		gradient.addColorStop(0, 'rgba(113,64,235,1)');
		gradient.addColorStop(0.1, 'rgba(113,64,235,1)');
		gradient.addColorStop(0.9, 'rgba(113,64,235,.05)');
		gradient.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = gradient; // "#FFFFFF"; // gradient;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		return canvas;
	}

	addListeners() {
		this.onMove = this.onMove.bind(this);
		const target = document.querySelector('.world canvas');
		target.addEventListener('mousemove', this.onMove);
		target.addEventListener('touchmove', this.onMove);
	}

	removeListeners() {
		const target = document.querySelector('.world canvas');
		target.removeEventListener('mousemove', this.onMove);
		target.removeEventListener('touchmove', this.onMove);
	}

}

ModelMoreComponent.ORIGIN = new THREE.Vector3();

ModelMoreComponent.meta = {
	selector: '[model-more]',
	hosts: { host: WorldComponent },
	outputs: ['down'],
};
