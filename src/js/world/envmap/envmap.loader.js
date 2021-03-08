import { fromEvent } from 'rxjs';
import { filter, first, switchMap, takeWhile, tap } from 'rxjs/operators';
import { AssetType } from '../../asset/asset';
import { environment } from '../../environment';
import ImageService, { ImageServiceEvent } from '../../image/image.service';
import LoaderService from '../../loader/loader.service';
import StreamService from '../../stream/stream.service';
// import DebugService from '../debug.service';

export class EnvMapLoader {

	static get video() {
		return this.video_;
	}

	static set video(video) {
		if (this.video_) {
			this.video_.muted = true;
			this.video_.pause();
			if (this.video_.parentNode) {
				this.video_.parentNode.removeChild(this.video_);
			}
			this.video_ = null;
		}
		if (video) {
			const video = this.video_ = document.createElement('video');
			video.loop = true;
			// video.muted = true;
			video.playsInline = true;
			video.crossOrigin = 'anonymous';
			// document.querySelector('body').appendChild(video);
		}
	}

	static get muted() {
		return this.muted_;
	}

	static set muted(muted) {
		this.muted_ = muted;
		// console.log('EnvMapLoader.muted', muted, this.video);
		if (this.video) {
			this.video.muted = muted === true;
		}
	}

	static set cubeRenderTarget(cubeRenderTarget) {
		if (this.cubeRenderTarget_) {
			this.cubeRenderTarget_.texture.dispose();
			this.cubeRenderTarget_.dispose();
		}
		this.cubeRenderTarget_ = cubeRenderTarget;
	}

	static set texture(texture) {
		if (this.texture_) {
			this.texture_.dispose();
		}
		this.texture_ = texture;
	}

	static load(item, renderer, callback) {
		this.video = null;
		if (!item.asset) {
			return;
		}
		if (item.asset.type.name === AssetType.PublisherStream.name) {
			return this.loadPublisherStreamBackground(renderer, callback);
		} else if (item.asset.file.indexOf('.mp4') !== -1 || item.asset.file.indexOf('.webm') !== -1) {
			return this.loadVideoBackground(environment.getPath(item.asset.folder), item.asset.file, renderer, callback);
		} else if (item.asset.file.indexOf('.m3u8') !== -1) {
			return this.loadHlslVideoBackground(item.asset.file, renderer, callback);
		} else if (item.asset.file.indexOf('.hdr') !== -1) {
			return this.loadRgbeBackground(environment.getPath(item.asset.folder), item.asset.file, renderer, callback);
		} else {
			return this.loadBackgroundImageService(environment.getPath(item.asset.folder), item.asset.file, renderer, callback);
		}
	}

	static loadBackground(folder, file, renderer, callback) {
		const pmremGenerator = new THREE.PMREMGenerator(renderer);
		pmremGenerator.compileEquirectangularShader();
		const progressRef = LoaderService.getRef();
		// console.log('loadBackground.progressRef');
		const loader = new THREE.TextureLoader();
		loader.setPath(folder).load(file, (texture) => {
			const envMap = pmremGenerator.fromEquirectangular(texture).texture;
			pmremGenerator.dispose();
			if (typeof callback === 'function') {
				callback(envMap, texture, false);
			}
			LoaderService.setProgress(progressRef, 1);
		}, (request) => {
			console.log(request.loaded, request.total);
			LoaderService.setProgress(progressRef, request.loaded, request.total);
		});
		return loader;
	}

	static loadBackgroundImageService(folder, file, renderer, callback) {
		const pmremGenerator = new THREE.PMREMGenerator(renderer);
		pmremGenerator.compileEquirectangularShader();
		const progressRef = LoaderService.getRef();
		const image = new Image();
		ImageService.events$(folder + file).pipe(
			tap(event => {
				if (event.type === ImageServiceEvent.Progress) {
					LoaderService.setProgress(progressRef, event.data.loaded, event.data.total);
				}
			}),
			filter(event => event.type === ImageServiceEvent.Complete),
			switchMap(event => {
				const load = fromEvent(image, 'load');
				image.crossOrigin = 'anonymous';
				image.src = event.data;
				return load;
			}),
			takeWhile(event => event.type !== ImageServiceEvent.Complete, true),
		).subscribe(event => {
			URL.revokeObjectURL(event.data);
			const texture = new THREE.Texture(image);
			const envMap = pmremGenerator.fromEquirectangular(texture).texture;
			pmremGenerator.dispose();
			if (typeof callback === 'function') {
				callback(envMap, texture, false);
			}
			LoaderService.setProgress(progressRef, 1);
		});
	}

	static loadRgbeBackground(folder, file, renderer, callback) {
		const pmremGenerator = new THREE.PMREMGenerator(renderer);
		pmremGenerator.compileEquirectangularShader();
		const progressRef = LoaderService.getRef();
		const loader = new THREE.RGBELoader();
		loader
			.setDataType(THREE.UnsignedByteType)
			// .setDataType(THREE.FloatType)
			.setPath(folder)
			.load(file, (texture) => {
				const envMap = pmremGenerator.fromEquirectangular(texture).texture;
				// texture.dispose();
				pmremGenerator.dispose();
				if (typeof callback === 'function') {
					callback(envMap, texture, true);
				}
				LoaderService.setProgress(progressRef, 1);
			}, (request) => {
				LoaderService.setProgress(progressRef, request.loaded, request.total);
			});
		return loader;
	}

	static loadHlslVideoBackground(src, renderer, callback) {
		const progressRef = LoaderService.getRef();
		const video = document.createElement('video');
		const onPlaying = () => {
			video.oncanplay = null;
			const texture = new THREE.VideoTexture(video);
			texture.minFilter = THREE.LinearFilter;
			texture.magFilter = THREE.LinearFilter;
			texture.mapping = THREE.UVMapping;
			texture.format = THREE.RGBFormat;
			texture.needsUpdate = true;
			// const envMap = new THREE.VideoTexture(video);
			const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(1024, {
				generateMipmaps: true,
				// minFilter: THREE.LinearMipmapLinearFilter,
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter,
				mapping: THREE.UVMapping,
				format: THREE.RGBFormat
			}).fromEquirectangularTexture(renderer, texture);
			// texture.dispose();
			if (typeof callback === 'function') {
				callback(cubeRenderTarget.texture, texture, false);
			}
			LoaderService.setProgress(progressRef, 1);
		};
		video.oncanplay = () => {
			// console.log('videoReady', videoReady);
			onPlaying();
		};
		if (Hls.isSupported()) {
			var hls = new Hls();
			// bind them together
			hls.attachMedia(video);
			hls.on(Hls.Events.MEDIA_ATTACHED, () => {
				hls.loadSource(src);
				hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
					// console.log('HlsDirective', data.levels);
					video.play();
				});
			});
		}
	}

	static loadVideoBackground(folder, file, renderer, callback) {
		const progressRef = LoaderService.getRef();
		// const debugService = DebugService.getService();
		this.video = true;
		const video = this.video;
		const onPlaying = () => {
			video.oncanplay = null;
			const texture = new THREE.VideoTexture(video);
			texture.minFilter = THREE.LinearFilter;
			texture.magFilter = THREE.LinearFilter;
			texture.mapping = THREE.UVMapping;
			texture.format = THREE.RGBFormat;
			texture.needsUpdate = true;
			// const envMap = new THREE.VideoTexture(video);
			const cubeRenderTarget = this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(1024, {
				generateMipmaps: true,
				// minFilter: THREE.LinearMipmapLinearFilter,
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter,
				mapping: THREE.UVMapping,
				format: THREE.RGBFormat
			}).fromEquirectangularTexture(renderer, texture);
			// texture.dispose();
			if (typeof callback === 'function') {
				callback(cubeRenderTarget.texture, texture, false);
			}
			LoaderService.setProgress(progressRef, 1);
		};
		// video.addEventListener('playing', onPlaying);
		video.oncanplay = () => {
			// console.log('EnvMapLoader.loadVideoBackground.oncanplay');
			onPlaying();
		};
		video.src = folder + file;
		video.load();
		video.play().then(() => {
			// console.log('EnvMapLoader.loadVideoBackground.play');
			// debugService.setMessage(`play ${video.src}`);
		}, error => {
			console.log('EnvMapLoader.loadVideoBackground.play.error', error);
			// debugService.setMessage(`play.error ${video.src}`);
		});
	}

	static loadPublisherStreamBackground(renderer, callback) {
		const onPublisherStreamId = (publisherStreamId) => {
			// const target = StateService.state.role === RoleType.Publisher ? '.video--local' : '.video--remote';
			const target = `#stream-${publisherStreamId}`;
			const video = document.querySelector(`${target} video`);
			if (!video) {
				return;
			}
			const onPlaying = () => {
				const texture = this.texture = new THREE.VideoTexture(video);
				texture.minFilter = THREE.LinearFilter;
				texture.magFilter = THREE.LinearFilter;
				texture.mapping = THREE.UVMapping;
				texture.format = THREE.RGBFormat;
				texture.needsUpdate = true;
				const cubeRenderTarget = this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(1024, {
					generateMipmaps: true,
					// minFilter: THREE.LinearMipmapLinearFilter,
					minFilter: THREE.LinearFilter,
					magFilter: THREE.LinearFilter,
					mapping: THREE.UVMapping,
					format: THREE.RGBFormat
				}).fromEquirectangularTexture(renderer, texture);
				// texture.dispose();
				if (typeof callback === 'function') {
					callback(cubeRenderTarget.texture, texture, false);
				}
			};
			video.crossOrigin = 'anonymous';
			if (video.readyState >= video.HAVE_FUTURE_DATA) {
				onPlaying();
			} else {
				video.oncanplay = () => {
					onPlaying();
				};
			}
		};
		StreamService.getPublisherStreamId$().pipe(
			first(),
		).subscribe(publisherStreamId => onPublisherStreamId(publisherStreamId));
	}

}
