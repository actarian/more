

export default class Camera extends THREE.PerspectiveCamera {
	constructor(fov = 70, aspect = 1, near = 0.01, far = 1000, dolly = 70) {
		super(fov, aspect, near, far);
		this.target = new THREE.Vector3();
		this.box = new THREE.Group();
		this.add(this.box);
	}
}
