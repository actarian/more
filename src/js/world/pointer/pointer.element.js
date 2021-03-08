import { environment } from '../../environment';
import Interactive from '../interactive/interactive';

const ORIGIN = new THREE.Vector3();

export default class PointerElement {

	constructor(color = '#ffffff') {
		const geometry = new THREE.PlaneBufferGeometry(1.2, 1.2, 2, 2);
		const loader = new THREE.TextureLoader();
		const texture = loader.load(environment.getPath('textures/ui/nav-point.png'));
		const material = new THREE.MeshBasicMaterial({
			color: new THREE.Color(color),
			depthTest: false,
			depthWrite: false,
			map: texture,
			transparent: true,
			opacity: 0.9,
		});
		const mesh = this.mesh = new THREE.Mesh(geometry, material);
		mesh.renderOrder = environment.renderOrder.pointer;
		mesh.position.set(-100000, -100000, -100000);
	}

	update() {
		if (Interactive.lastIntersectedObject) {
			const mesh = this.mesh;
			const position = Interactive.lastIntersectedObject.intersection.point.multiplyScalar(0.99);
			mesh.position.set(position.x, position.y, position.z);
			const s = mesh.position.length() / 80;
			mesh.scale.set(s, s, s);
			mesh.lookAt(ORIGIN);
		}
	}

	setPosition(x, y, z) {
		const mesh = this.mesh;
		mesh.position.set(x, y, z).multiplyScalar(80);
		const s = mesh.position.length() / 80;
		mesh.scale.set(s, s, s);
		mesh.lookAt(ORIGIN);
		// console.log('PointerElement.setPosition', x, y, z);
	}
}
