// import { auditTime, tap } from "rxjs/operators";
// import AudioStreamService from "../../audio/audio-stream.service";
import StreamService from "../../stream/stream.service";

export const W = 320;
export const H = 240;
export const COLORS = [0xffcc00, 0x00ffcc, 0x00ccff, 0xccff00, 0xcc00ff, 0xffffff];

export default class AvatarElement {

	static get headGeometry() {
		if (!this.headGeometry_) {
			this.headGeometry_ = new THREE.SphereBufferGeometry(0.2, 48, 48);
		}
		return this.headGeometry_;
	}

	constructor(message) {
		const clientId = this.clientId = message.clientId;
		const container = this.container = message.container;
		const renderer = this.renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: false,
			premultipliedAlpha: true,
			// physicallyCorrectLights: true,
		});
		renderer.setClearColor(0x000000, 1);
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(W, H);
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 0.8;
		renderer.outputEncoding = THREE.sRGBEncoding;
		container.appendChild(renderer.domElement);

		const camera = this.camera = new THREE.PerspectiveCamera(70, W / H, 0.01, 1000);
		camera.position.set(0, 0, -0.5);
		camera.target = new THREE.Vector3();
		camera.lookAt(camera.target);

		const scene = this.scene = new THREE.Scene();

		/*
		const ambient = this.ambient = new THREE.AmbientLight(0x202020);
		scene.add(ambient);
		*/

		const light = this.light = new THREE.PointLight(0xffffff, 1, 100);
		light.position.set(0, 2, -2);
		scene.add(light);

		const head = this.head = this.addHead();
		scene.add(head);

		const remote = this.remote = StreamService.getRemoteById(clientId);
		/*
		if (remote) {
			this.subscription = AudioStreamService.volume$(remote.stream).pipe(
				auditTime(Math.floor(1000 / 15)),
				tap(meter => {
					this.chalk(meter.volume);
				})
			);
		}
		*/
	}

	addHead() {
		const geometry = AvatarElement.headGeometry;
		const canvas = this.canvas = document.createElement('canvas');
		canvas.width = 1024;
		canvas.height = 512;
		const ctx = this.ctx = this.canvas.getContext('2d');
		const map = this.map = new THREE.CanvasTexture(canvas);
		map.offset.x = -0.25;
		const color = COLORS[this.clientId % COLORS.length];
		const material = new THREE.MeshStandardMaterial({
			map: map,
			color: color,
		});
		this.chalk(0);
		return new THREE.Mesh(geometry, material);
	}

	render() {
		const tick = this.tick_ ? ++this.tick_ : this.tick_ = 1;
		// if (tick % 2 === 1) {
		if (this.remote) {
			const audioLevel = this.remote.getAudioLevel() * 12;
			this.chalk(audioLevel);
		}
		const renderer = this.renderer,
			scene = this.scene,
			camera = this.camera;
		renderer.render(scene, camera);
		// }
	}

	update(message) {
		const camera = message.camera;
		const head = this.head;
		head.quaternion.set(camera[3], camera[4], camera[5], camera[6]);
		/*
		head.position.set(camera[0], camera[1], camera[2]);
		*/
	}

	dispose() {
		// !!! dispose threejs
		if (this.subscription) {
			this.subscription.unsubscribe();
		}
	}

	chalk(i) {
		i = (i + Math.PI * 0.5) % (Math.PI * 2);
		const vol = Math.sin(i) * 30;
		const smile = Math.cos(i) * 10;
		const x = 512;
		const y = 256;
		const ctx = this.ctx;
		ctx.fillStyle = '#888888';
		ctx.fillRect(0, 0, 1024, 512);
		ctx.fillStyle = 'white';
		ctx.beginPath();
		ctx.arc(x - 40, y - 50, 7, 0, 2 * Math.PI);
		ctx.arc(x + 40, y - 50, 7, 0, 2 * Math.PI);
		ctx.closePath();
		ctx.fill();
		ctx.beginPath();
		// ctx.quadraticCurveTo(x - 30, y + 30, x - 30, y + 30);
		// ctx.quadraticCurveTo(x - 30, y + 60, x, y + 60);
		// ctx.quadraticCurveTo(x + 30, y + 60, x + 30, y + 30);
		// ctx.quadraticCurveTo(x + 30, y, x, y);
		ctx.moveTo(x - 40 - smile, y + 30);
		ctx.bezierCurveTo(x - 40 - smile, y + 60, x + 40 + smile, y + 60, x + 40 + smile, y + 30);
		ctx.bezierCurveTo(x + 40 + smile, y + vol, x - 40 - smile, y + vol, x - 40 - smile, y + 30);
		// ctx.arc(x, 256 + 50, 50, 0, 2 * Math.PI);
		ctx.closePath();
		ctx.fill();
		this.map.needsUpdate = true;
	}

}
