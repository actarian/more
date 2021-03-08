import { of } from 'rxjs';
import { map } from 'rxjs/operators';
import { assetIsStream, AssetType } from '../../asset/asset';
import { environment } from '../../environment';
import StreamService from '../../stream/stream.service';
import { RoleType } from '../../user/user';
import InteractiveMesh from '../interactive/interactive.mesh';
import MediaLoader, { MediaLoaderPauseEvent, MediaLoaderPlayEvent } from './media-loader';

const VERTEX_SHADER = `
#extension GL_EXT_frag_depth : enable

varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
#extension GL_EXT_frag_depth : enable

varying vec2 vUv;
uniform bool video;
uniform float opacity;
uniform float overlay;
uniform float tween;
uniform sampler2D textureA;
uniform sampler2D textureB;
uniform vec2 resolutionA;
uniform vec2 resolutionB;
uniform vec3 overlayColor;

void main() {
	vec4 color;
	vec4 colorA = texture2D(textureA, vUv);
	if (video) {
		vec4 colorB = texture2D(textureB, vUv);
		color = vec4(colorA.rgb + (overlayColor * overlay * 0.2) + (colorB.rgb * tween * colorB.a), opacity);
	} else {
		color = vec4(colorA.rgb + (overlayColor * overlay * 0.2), opacity);
	}
	gl_FragColor = color;
}
`;

const FRAGMENT_CHROMA_KEY_SHADER = `
#extension GL_EXT_frag_depth : enable

#define threshold 0.55
#define padding 0.05

varying vec2 vUv;
uniform bool video;
uniform float opacity;
uniform float overlay;
uniform float tween;
uniform sampler2D textureA;
uniform sampler2D textureB;
uniform vec2 resolutionA;
uniform vec2 resolutionB;
uniform vec3 chromaKeyColor;
uniform vec3 overlayColor;

void main() {
	vec4 color;
	vec4 colorA = texture2D(textureA, vUv);
	vec4 chromaKey = vec4(chromaKeyColor, 1.0);
    vec3 chromaKeyDiff = colorA.rgb - chromaKey.rgb;
    float chromaKeyValue = smoothstep(threshold - padding, threshold + padding, dot(chromaKeyDiff, chromaKeyDiff));
	color = vec4(colorA.rgb + (overlayColor * overlay * 0.2), opacity * chromaKeyValue);
	gl_FragColor = color;
}
`;

export default class MediaMesh extends InteractiveMesh {

	static getMaterial(useChromaKey) {
		const material = new THREE.ShaderMaterial({
			depthTest: false,
			depthWrite: false,
			transparent: true,
			vertexShader: VERTEX_SHADER,
			fragmentShader: useChromaKey ? FRAGMENT_CHROMA_KEY_SHADER : FRAGMENT_SHADER,
			uniforms: {
				video: { value: false },
				textureA: { type: "t", value: null },
				textureB: { type: "t", value: null },
				resolutionA: { value: new THREE.Vector2() },
				resolutionB: { value: new THREE.Vector2() },
				overlayColor: { value: new THREE.Color('#000000') },
				overlay: { value: 0 },
				tween: { value: 1 },
				opacity: { value: 0 },
			},
			// side: THREE.DoubleSide
		});
		return material;
	}

	static getChromaKeyMaterial(chromaKeyColor = [0.0, 1.0, 0.0]) {
		const material = new THREE.ShaderMaterial({
			depthTest: false,
			depthWrite: false,
			transparent: true,
			vertexShader: VERTEX_SHADER,
			fragmentShader: FRAGMENT_CHROMA_KEY_SHADER,
			uniforms: {
				video: { value: false },
				textureA: { type: "t", value: null },
				textureB: { type: "t", value: null },
				resolutionA: { value: new THREE.Vector2() },
				resolutionB: { value: new THREE.Vector2() },
				chromaKeyColor: { value: new THREE.Vector3(chromaKeyColor[0], chromaKeyColor[1], chromaKeyColor[2]) },
				overlayColor: { value: new THREE.Color('#000000') },
				overlay: { value: 0 },
				tween: { value: 1 },
				opacity: { value: 0 },
			},
			side: THREE.DoubleSide
		});
		return material;
	}

	static isPublisherStream(stream) {
		return stream.clientInfo && stream.clientInfo.role === RoleType.Publisher;
	}
	static isAttendeeStream(stream) {
		return stream.clientInfo && stream.clientInfo.role === RoleType.Attendee;
	}
	static isSmartDeviceStream(stream) {
		return stream.clientInfo && stream.clientInfo.role === RoleType.SmartDevice;
	}
	static isPublisherScreen(stream) {
		return stream.clientInfo && stream.clientInfo.role === RoleType.Publisher && stream.clientInfo.uid !== stream.getId();
	}
	static isAttendeeScreen(stream) {
		return stream.clientInfo && stream.clientInfo.role === RoleType.Attendee && stream.clientInfo.uid !== stream.getId();
	}
	static getTypeMatcher(assetType) {
		let matcher;
		switch (assetType.name) {
			case AssetType.PublisherStream.name:
				matcher = this.isPublisherStream;
				break;
			case AssetType.AttendeeStream.name:
				matcher = this.isAttendeeStream;
				break;
			case AssetType.SmartDeviceStream.name:
				matcher = this.isSmartDeviceStream;
				break;
			case AssetType.PublisherScreen.name:
				matcher = this.isPublisherScreen;
				break;
			case AssetType.AttendeeScreen.name:
				matcher = this.isAttendeeScreen;
				break;
			default:
				matcher = (stream) => { return false; }
		}
		return matcher;
	}

	static getStreamId$(item) {
		if (!item.asset) {
			return of(null);
		}
		const assetType = item.asset.type;
		const file = item.asset.file;
		if (assetIsStream(item.asset)) {
			return StreamService.streams$.pipe(
				map((streams) => {
					let stream;
					let i = 0;
					const matchType = this.getTypeMatcher(assetType);
					streams.forEach(x => {
						if (matchType(x)) {
							if (i === item.asset.index) {
								stream = x;
							}
							i++;
						}
					});
					// console.log('MediaMesh.getStreamId$', assetType.name, stream, streams);
					if (stream) {
						return stream.getId();
					} else {
						return null;
					}
				}),
			);
		} else {
			return of(file);
		}
	}

	static getMaterialByItem(item) {
		let material;
		if (item.asset && item.asset.chromaKeyColor) {
			material = MediaMesh.getChromaKeyMaterial(item.asset.chromaKeyColor);
		} else if (item.asset) {
			material = MediaMesh.getMaterial();
		} else {
			material = new THREE.MeshBasicMaterial({ color: 0x888888 });
		}
		return material;
	}

	static getUniformsByItem(item) {
		let uniforms = null;
		if (item.asset) {
			uniforms = {
				overlay: 0,
				tween: 1,
				opacity: 0,
			};
		}
		return uniforms;
	}

	constructor(item, items, geometry) {
		const material = MediaMesh.getMaterialByItem(item);
		super(geometry, material);
		this.item = item;
		this.items = items;
		this.renderOrder = environment.renderOrder.plane;
		this.uniforms = MediaMesh.getUniformsByItem(item);
		const mediaLoader = this.mediaLoader = new MediaLoader(item);
		/*
		if (item.asset && !mediaLoader.isVideo) {
			this.freeze();
		}
		*/
	}

	load(callback) {
		if (!this.item.asset) {
			this.onAppear();
			if (typeof callback === 'function') {
				callback(this);
			}
			return;
		}
		const material = this.material;
		const mediaLoader = this.mediaLoader;
		mediaLoader.load((textureA) => {
			// console.log('MediaMesh.textureA', textureA);
			if (textureA) {
				material.uniforms.textureA.value = textureA;
				// material.uniforms.resolutionA.value.x = textureA.image.width;
				// material.uniforms.resolutionA.value.y = textureA.image.height;
				material.uniforms.resolutionA.value = new THREE.Vector2(textureA.image.width || textureA.image.videoWidth, textureA.image.height || textureA.image.videoHeight);
				material.needsUpdate = true;
				if (mediaLoader.isPlayableVideo) {
					this.createTextureB(textureA, (textureB) => {
						// console.log('MediaMesh.textureB', textureB);
						textureB.minFilter = THREE.LinearFilter;
						textureB.magFilter = THREE.LinearFilter;
						textureB.mapping = THREE.UVMapping;
						// textureB.format = THREE.RGBFormat;
						textureB.wrapS = THREE.RepeatWrapping;
						textureB.wrapT = THREE.RepeatWrapping;
						material.uniforms.textureB.value = textureB;
						// material.uniforms.resolutionB.value.x = textureB.image.width;
						// material.uniforms.resolutionB.value.y = textureB.image.height;
						material.uniforms.resolutionB.value = new THREE.Vector2(textureB.image.width, textureB.image.height);
						// console.log(material.uniforms.resolutionB.value, textureB);
						material.needsUpdate = true;
					});
				}
			}
			this.onAppear();
			if (mediaLoader.isPlayableVideo) {
				material.uniforms.video.value = true;
				this.onOver = this.onOver.bind(this);
				this.onOut = this.onOut.bind(this);
				this.onToggle = this.onToggle.bind(this);
				this.on('over', this.onOver);
				this.on('out', this.onOut);
				this.on('down', this.onToggle);
			}
			if (typeof callback === 'function') {
				callback(this);
			}
		});
	}

	createTextureB(textureA, callback) {
		const aw = textureA.image.width || textureA.image.videoWidth;
		const ah = textureA.image.height || textureA.image.videoHeight;
		const ar = aw / ah;
		const scale = 0.32;
		const canvas = document.createElement('canvas');
		// document.querySelector('body').appendChild(canvas);
		canvas.width = aw;
		canvas.height = ah;
		const ctx = canvas.getContext('2d');
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		const image = new Image();
		image.onload = function() {
			const bw = image.width;
			const bh = image.height;
			const br = bw / bh;
			let w;
			let h;
			if (ar > br) {
				w = ah * scale;
				h = w / br;
			} else {
				h = aw * scale;
				w = h * br;
			}
			ctx.drawImage(image, aw / 2 - w / 2, ah / 2 - h / 2, w, h);
			const textureB = new THREE.CanvasTexture(canvas);
			if (typeof callback === 'function') {
				callback(textureB);
			}
		}
		image.crossOrigin = 'anonymous';
		image.src = environment.getPath('textures/ui/play.png');
	}

	events$() {
		const item = this.item;
		const items = this.items;
		if (item.asset && item.asset.linkedPlayId) {
			this.freeze();
		}
		return MediaLoader.events$.pipe(
			map(event => {
				if (item.asset && item.asset.linkedPlayId) {
					const eventItem = items.find(x => x.asset && event.src.indexOf(x.asset.file) !== -1 && event.id === item.asset.linkedPlayId);
					if (eventItem) {
						// console.log('MediaLoader.events$.eventItem', event, eventItem);
						if (event instanceof MediaLoaderPlayEvent) {
							this.play();
						} else if (event instanceof MediaLoaderPauseEvent) {
							this.pause();
						}
					}
				}
				return event;
			})
		);
	}

	onAppear() {
		const uniforms = this.uniforms;
		const material = this.material;
		if (material.uniforms) {
			gsap.to(uniforms, {
				duration: 0.4,
				opacity: 1,
				ease: Power2.easeInOut,
				onUpdate: () => {
					material.uniforms.opacity.value = uniforms.opacity;
					material.needsUpdate = true;
				},
			});
		}
	}

	onDisappear() {
		const uniforms = this.uniforms;
		const material = this.material;
		if (material.uniforms) {
			gsap.to(uniforms, {
				duration: 0.4,
				opacity: 0,
				ease: Power2.easeInOut,
				onUpdate: () => {
					material.uniforms.opacity.value = uniforms.opacity;
					material.needsUpdate = true;
				},
			});
		}
	}

	onOver() {
		const uniforms = this.uniforms;
		const material = this.material;
		if (material.uniforms) {
			gsap.to(uniforms, {
				duration: 0.4,
				overlay: 1,
				tween: this.playing ? 0 : 1,
				opacity: 1,
				ease: Power2.easeInOut,
				overwrite: true,
				onUpdate: () => {
					material.uniforms.overlay.value = uniforms.overlay;
					material.uniforms.tween.value = uniforms.tween;
					material.uniforms.opacity.value = uniforms.opacity;
					material.needsUpdate = true;
				},
			});
		}
	}

	onOut() {
		const uniforms = this.uniforms;
		const material = this.material;
		if (material.uniforms) {
			gsap.to(uniforms, {
				duration: 0.4,
				overlay: 0,
				tween: this.playing ? 0 : 1,
				opacity: 1,
				ease: Power2.easeInOut,
				overwrite: true,
				onUpdate: () => {
					material.uniforms.overlay.value = uniforms.overlay;
					material.uniforms.tween.value = uniforms.tween;
					material.uniforms.opacity.value = uniforms.opacity;
					material.needsUpdate = true;
				},
			});
		}
	}

	onToggle() {
		this.playing = this.mediaLoader.toggle();
		this.emit('playing', this.playing);
		this.onOut();
	}

	play() {
		this.mediaLoader.play();
		this.playing = true;
		this.emit('playing', true);
		this.onOut();
	}

	pause() {
		this.mediaLoader.pause();
		this.playing = false;
		this.emit('playing', false);
		this.onOut();
	}

	setPlayingState(playing) {
		if (this.playing !== playing) {
			this.playing = playing;
			playing ? this.mediaLoader.play() : this.mediaLoader.pause();
			this.onOut();
		}
	}

	updateByItem(item) {
		this.disposeMaterial();
		this.disposeMediaLoader();
		this.material = MediaMesh.getMaterialByItem(item);
		this.uniforms = MediaMesh.getUniformsByItem(item);
		this.mediaLoader = new MediaLoader(item);
	}

	disposeMaterial() {
		if (this.material) {
			if (this.material.map && this.material.map.disposable !== false) {
				this.material.map.dispose();
			}
			this.material.dispose();
			this.material = null;
		}
	}

	disposeMediaLoader() {
		const mediaLoader = this.mediaLoader;
		if (mediaLoader) {
			if (mediaLoader.isPlayableVideo) {
				this.off('over', this.onOver);
				this.off('out', this.onOut);
				this.off('down', this.onToggle);
			}
			mediaLoader.dispose();
			this.mediaLoader = null;
		}
	}

	dispose() {
		this.disposeMediaLoader();
	}
}

/*
const FRAGMENT_SHADER_BAK = `
#extension GL_EXT_frag_depth : enable

varying vec2 vUv;
uniform bool video;
uniform float opacity;
uniform float overlay;
uniform float tween;
uniform sampler2D textureA;
uniform sampler2D textureB;
uniform vec2 resolutionA;
uniform vec2 resolutionB;
uniform vec3 overlayColor;

mat3 rotate(float a) {
	return mat3(
		cos(a), sin(a), 0.0,
		-sin(a), cos(a), 0.0,
		0.0, 0.0, 1.0
	);
}

mat3 translate(vec2 t) {
	return mat3(
		1.0, 0.0, 0.0,
		0.0, 1.0, 0.0,
		t.x, t.y, 1.0
	);
}

mat3 scale(vec2 s) {
	return mat3(
		s.x, 0.0, 0.0,
		0.0, s.y, 0.0,
		0.0, 0.0, 1.0
	);
}

vec2 getUV2(vec2 vUv, vec2 t, vec2 s, float a) {
	mat3 transform = scale(s) * rotate(a);
	return (vec3(vUv + t, 0.0) * transform).xy;
}

void main() {
	vec4 color;
	vec4 colorA = texture2D(textureA, vUv);
	if (video) {
		float rA = resolutionA.x / resolutionA.y;
		float rB = resolutionB.x / resolutionB.y;
		float aspect = 1.0 / rA * rB;
		vec2 s = vec2(3.0 / aspect, 3.0);
		vec2 t = vec2(
			-(resolutionA.x - resolutionB.x / s.x) * 0.5 / resolutionA.x,
			-(resolutionA.y - resolutionB.y / s.y) * 0.5 / resolutionA.y
		);
		t = vec2(
			-(resolutionA.x - resolutionB.x / s.y) * 0.5 / resolutionA.x,
			-(resolutionA.y - resolutionB.y / s.y) * 0.5 / resolutionA.y
		);
		// float dx = (resolutionA.x - resolutionB.x) / resolutionA.x * 0.5;
		// float dy = (resolutionA.y - resolutionB.y) / resolutionA.y * 0.5;
		// t = vec2(-0.5 + dx, -0.5 - dy);
		vec2 uv2 = clamp(
			getUV2(vUv, t, s, 0.0),
			vec2(0.0,0.0),
			vec2(1.0,1.0)
		);
		vec4 colorB = texture2D(textureB, uv2);
		colorB = texture2D(textureB, vUv);
		color = vec4(colorA.rgb + (overlayColor * overlay * 0.2) + (colorB.rgb * tween * colorB.a), opacity);
	} else {
		color = vec4(colorA.rgb + (overlayColor * overlay * 0.2), opacity);
	}
	gl_FragColor = color;
}
`;
*/
