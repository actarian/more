import { Texture } from 'three';

function VideoTexture(video, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy) {
	Texture.call(this, video, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy);
	this.format = format !== undefined ? format : THREE.RGBFormat;
	this.minFilter = minFilter !== undefined ? minFilter : THREE.LinearFilter;
	this.magFilter = magFilter !== undefined ? magFilter : THREE.LinearFilter;
	this.mapping = THREE.UVMapping;
	this.generateMipmaps = false;
}

VideoTexture.prototype = Object.assign(Object.create(Texture.prototype), {

	constructor: VideoTexture,

	isVideoTexture: true,

	update: function() {
		var video = this.image;
		if (video.readyState >= video.HAVE_CURRENT_DATA) {
			this.needsUpdate = true;
		}
	}

});

export { VideoTexture };
