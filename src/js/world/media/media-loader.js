import { ReplaySubject } from 'rxjs';
import { assetIsStream, AssetType } from '../../asset/asset';
import { environment } from '../../environment';
import StateService from '../../state/state.service';

export class MediaLoaderEvent {
	constructor(src, id) {
		this.src = src;
		this.id = id;
	}
}

export class MediaLoaderPlayEvent extends MediaLoaderEvent { }

export class MediaLoaderPauseEvent extends MediaLoaderEvent { }

export default class MediaLoader {

	static getLoader() {
		return MediaLoader.loader || (MediaLoader.loader = new THREE.TextureLoader());
	}

	static getPath(item) {
		return environment.getPath(item.asset.folder + item.asset.file);
	}

	static loadTexture(item, callback) {
		const path = MediaLoader.getPath(item);
		return MediaLoader.getLoader().load(path, callback);
	}

	static isVideo(item) {
		return item.asset && item.asset.file && (item.asset.file.indexOf('.mp4') !== -1 || item.asset.file.indexOf('.webm') !== -1);
	}

	static isStream(item) {
		return assetIsStream(item.asset);
	}

	static isPublisherStream(item) {
		return item.asset && item.asset.type.name === AssetType.PublisherStream.name;
	}

	static isAttendeeStream(item) {
		return item.asset && item.asset.type.name === AssetType.AttendeeStream.name;
	}

	static isSmartDeviceStream(item) {
		return item.asset && item.asset.type.name === AssetType.SmartDeviceStream.name;
	}

	static isPublisherScreen(item) {
		return item.asset && item.asset.type.name === AssetType.PublisherScreen.name;
	}

	static isAttendeeScreen(item) {
		return item.asset && item.asset.type.name === AssetType.AttendeeScreen.name;
	}

	get isVideo() {
		return MediaLoader.isVideo(this.item);
	}

	get isStream() {
		return MediaLoader.isStream(this.item);
	}

	get isPublisherStream() {
		return MediaLoader.isPublisherStream(this.item);
	}

	get isAttendeeStream() {
		return MediaLoader.isAttendeeStream(this.item);
	}

	get isSmartDeviceStream() {
		return MediaLoader.isSmartDeviceStream(this.item);
	}

	get isPublisherScreen() {
		return MediaLoader.isPublisherScreen(this.item);
	}

	get isAttendeeScreen() {
		return MediaLoader.isAttendeeScreen(this.item);
	}

	get isPlayableVideo() {
		return this.isVideo && !this.item.asset.autoplay;
	}

	get isAutoplayVideo() {
		return this.isStream || (this.isVideo && (this.item.asset.autoplay != null));
	}

	get muted() {
		return this.muted_;
	}

	set muted(muted) {
		this.muted_ = muted;
		// console.log('MediaLoader.muted', muted, this.video);
		if (this.video) {
			this.video.muted = muted === true;
		}
	}

	constructor(item) {
		this.item = item;
		this.toggle = this.toggle.bind(this);
		this.muted_ = false;
		this.subscription = StateService.state$.subscribe(state => this.muted = state.volumeMuted);
	}

	load(callback) {
		const item = this.item;
		let texture;
		// console.log('MediaLoader.load', item, this.isStream);
		if (this.isStream && item.streamId) {
			const streamId = item.streamId;
			const target = `#stream-${streamId}`;
			const video = document.querySelector(`${target} video`);
			if (!video) {
				return;
			}
			const onCanPlay = () => {
				video.removeEventListener('canplay', onCanPlay);
				texture = this.texture = new THREE.VideoTexture(video);
				texture.minFilter = THREE.LinearFilter;
				texture.magFilter = THREE.LinearFilter;
				texture.mapping = THREE.UVMapping;
				texture.format = THREE.RGBFormat;
				// texture.image.width = video.videoWidth;
				// texture.image.height = video.videoHeight;
				texture.needsUpdate = true;
				if (typeof callback === 'function') {
					callback(texture, this);
				}
			};
			video.crossOrigin = 'anonymous';
			if (video.readyState >= video.HAVE_FUTURE_DATA) {
				onCanPlay();
			} else {
				video.addEventListener('canplay', onCanPlay);
			}
		} else if (this.isVideo) {
			// create the video element
			const video = this.video = document.createElement('video');
			video.preload = 'metadata';
			video.volume = 0.8;
			video.muted = true;
			video.playsInline = true;
			video.crossOrigin = 'anonymous';
			if (item.asset && item.asset.autoplay) {
				video.loop = true;
			}
			const onCanPlay = () => {
				video.oncanplay = null;
				texture = new THREE.VideoTexture(video);
				texture.minFilter = THREE.LinearFilter;
				texture.magFilter = THREE.LinearFilter;
				texture.mapping = THREE.UVMapping;
				texture.format = THREE.RGBFormat;
				// texture.image.width = video.videoWidth;
				// texture.image.height = video.videoHeight;
				texture.needsUpdate = true;
				if (!item.asset || !item.asset.autoplay) {
					video.pause();
				}
				if (typeof callback === 'function') {
					callback(texture, this);
				}
			};
			video.oncanplay = onCanPlay;
			video.src = MediaLoader.getPath(item);
			video.load(); // must call after setting/changing source
			this.play(true);
		} else if (item.asset) {
			MediaLoader.loadTexture(item, texture => {
				texture.minFilter = THREE.LinearFilter;
				texture.magFilter = THREE.LinearFilter;
				texture.mapping = THREE.UVMapping;
				// texture.format = THREE.RGBFormat;
				texture.wrapS = THREE.RepeatWrapping;
				texture.wrapT = THREE.RepeatWrapping;
				if (typeof callback === 'function') {
					callback(texture, this);
				}
			});
		} else {
			callback(null, this);
		}
		return this;
	}

	play(silent) {
		// console.log('MediaLoader.play');
		if (this.video) {
			this.video.play().then(() => {
				// console.log('MediaLoader.play.success', this.item.asset.file);
			}, error => {
				console.log('MediaLoader.play.error', this.item.asset.file, error);
			});
			if (!silent) {
				MediaLoader.events$.next(new MediaLoaderPlayEvent(this.video.src, this.item.id));
			}
		}
	}

	pause(silent) {
		// console.log('MediaLoader.pause');
		if (this.video) {
			this.video.muted = true;
			this.video.pause();
			if (!silent) {
				MediaLoader.events$.next(new MediaLoaderPauseEvent(this.video.src, this.item.id));
			}
		}
	}

	toggle() {
		// console.log('MediaLoader.toggle', this.video);
		if (this.video) {
			if (this.video.paused) {
				this.video.muted = this.muted_;
				this.play();
				return true;
			} else {
				this.pause();
				return false;
			}
		}
	}

	dispose() {
		this.subscription.unsubscribe();
		this.pause();
		delete this.video;
	}

}

MediaLoader.events$ = new ReplaySubject(1);
