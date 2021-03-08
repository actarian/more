import Emittable from '../interactive/emittable';

export class Gamepad extends Emittable {
	constructor(gamepad) {
		super();
		this.gamepad = gamepad;
		this.buttons = {};
		this.axes = {};
	}

	update() {
		this.updateButtons();
		this.updateAxes();
	}

	updateButtons() {
		this.gamepad.buttons.forEach((x, i) => {
			const pressed = x.pressed;
			const button = this.buttons[i] || (this.buttons[i] = new GamepadButton(i, this));
			if (button.pressed !== pressed) {
				button.pressed = pressed;
				if (pressed) {
					this.emit('press', button);
				} else if (status !== undefined) {
					this.emit('release', button);
				}
			}
		});
	}

	updateAxes() {
		const axes = this.gamepad.axes;
		for (let i = 0; i < axes.length; i += 2) {
			const index = Math.floor(i / 2);
			const axis = this.axes[index] || (this.axes[index] = new GamepadAxis(index, this));
			const x = axes[i];
			const y = axes[i + 1];
			if (axis.x !== x || axis.y !== y) {
				axis.x = x;
				axis.y = y;
				if (Math.abs(x) > Math.abs(y)) {
					const left = x < -0.85;
					const right = x > 0.85;
					if (axis.left !== left) {
						axis.left = left;
						this.emit((left ? 'left' : 'none'), axis);
						// console.log(`${axis.gamepad.hand} ${axis.gamepad.index} left ${left}`);
					}
					if (axis.right !== right) {
						axis.right = right;
						this.emit((right ? 'right' : 'none'), axis);
						// console.log(`${axis.gamepad.hand} ${axis.gamepad.index} right ${right}`);
					}
				} else {
					const up = y < -0.85;
					const down = y > 0.85;
					if (axis.up !== up) {
						axis.up = up;
						this.emit((up ? 'up' : 'none'), axis);
						// console.log(`${axis.gamepad.hand} ${axis.gamepad.index} up ${up}`);
					}
					if (axis.down !== down) {
						axis.down = down;
						this.emit((down ? 'down' : 'none'), axis);
						// console.log(`${axis.gamepad.hand} ${axis.gamepad.index} down ${down}`);
					}
				}
				this.emit('axis', axis);
			}
		}
	}

	feedback(strength = 0.1, duration = 50) {
		// !!! care for battery
		const actuators = this.gamepad.hapticActuators;
		if (actuators && actuators.length) {
			return actuators[0].pulse(strength, duration);
		} else {
			return Promise.reject();
		}
	}
}

class GamepadButton {
	constructor(index, gamepad) {
		this.index = index;
		this.gamepad = gamepad;
		this.pressed = false;
	}
}

class GamepadAxis extends THREE.Vector2 {
	constructor(index, gamepad) {
		super();
		this.index = index;
		this.gamepad = gamepad;
		this.left = this.right = this.up = this.down = false;
	}
}
