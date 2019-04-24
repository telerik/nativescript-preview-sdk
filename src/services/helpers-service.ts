import * as shortId from "shortid";
import * as nodeBtoa from "btoa";
import * as nodeAtob from "atob";
import * as md5 from "js-md5";

declare function escape(s: string): string;
declare function unescape(s: string): string;

export class HelpersService {
	private getHiddenProperty(): string {
		var prefixes = ['webkit', 'moz', 'ms', 'o'];
		if ('hidden' in document) {
			return 'hidden';
		}
		for (var i = 0; i < prefixes.length; i++) {
			if ((prefixes[i] + 'Hidden') in document)
				return prefixes[i] + 'Hidden';
		}
		return null;
	}

	isBrowserTabActive() {
		if (!this.isBrowser()) {
			// not in browser
			return true;
		}

		var property = this.getHiddenProperty();
		if (!property) return true;

		return !document[property];
	}

	areCaseInsensitiveEqual(value1: string, value2: string): boolean {
		return (value1 || "").toLowerCase() == (value2 || "").toLowerCase();
	}

	shortId(): string {
		return shortId.generate();
	}

	isBrowser(): boolean {
		return (typeof window !== "undefined");
	}

	base64Encode(input: string): string {
		if (this.isBrowser()) {
			return window.btoa(unescape(encodeURIComponent(input)))
		} else {
			return nodeBtoa(unescape(encodeURIComponent(input)));
		}
	}

	base64Decode(input: string): string {
		if (this.isBrowser()) {
			return decodeURIComponent(escape(window.atob(input)));
		} else {
			return decodeURIComponent(escape(nodeAtob(input)));
		}
	}

	// https://github.com/google/closure-library/blob/8598d87242af59aac233270742c8984e2b2bdbe0/closure/goog/crypt/crypt.js#L117-L143
	stringToByteArray(str: string, base64Encoded: boolean = false): Uint8Array {
		if (base64Encoded === true) {
			var raw = this.isBrowser() ? window.atob(str) : nodeAtob(str);
			var rawLength = raw.length;
			var array = new Uint8Array(new ArrayBuffer(rawLength));
			for (var i = 0; i < rawLength; i++) {
				array[i] = raw.charCodeAt(i);
			}
			return array;
		}

		if (this.isBrowser() && "TextEncoder" in window) {
			return new TextEncoder().encode(str);
		}

		var out = [], p = 0;
		for (var i = 0; i < str.length; i++) {
			var c = str.charCodeAt(i);
			if (c < 128) {
				out[p++] = c;
			} else if (c < 2048) {
				out[p++] = (c >> 6) | 192;
				out[p++] = (c & 63) | 128;
			} else if (((c & 0xFC00) == 0xD800) && (i + 1) < str.length && ((str.charCodeAt(i + 1) & 0xFC00) == 0xDC00)) {
				// Surrogate Pair
				c = 0x10000 + ((c & 0x03FF) << 10) + (str.charCodeAt(++i) & 0x03FF);
				out[p++] = (c >> 18) | 240;
				out[p++] = ((c >> 12) & 63) | 128;
				out[p++] = ((c >> 6) & 63) | 128;
				out[p++] = (c & 63) | 128;
			} else {
				out[p++] = (c >> 12) | 224;
				out[p++] = ((c >> 6) & 63) | 128;
				out[p++] = (c & 63) | 128;
			}
		}

		return new Uint8Array(out);
	}

	concatenateArrays(...arrays: Uint8Array[]): Uint8Array {
		let totalLength = 0;
		for (let arr of arrays) {
			totalLength += arr.length;
		}
		let result = new Uint8Array(totalLength);
		let offset = 0;
		for (let arr of arrays) {
			result.set(arr, offset);
			offset += arr.length;
		}
		return result;
	}

	calculateMD5(str: string | Uint8Array): string {
		return md5(str);
	}
}