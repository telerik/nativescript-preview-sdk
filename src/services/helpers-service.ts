import * as shortId from "shortid";

declare function escape(s: string): string;
declare function unescape(s: string): string;

export class HelpersService {
	private keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

	areCaseInsensitiveEqual(value1: string, value2: string): boolean {
		return (value1 || "").toLowerCase() == (value2 || "").toLowerCase();
	}

	shortId(): string {
		return shortId.generate();
	}

	base64Encode(input: string): string {
		if (window.btoa) {
			return window.btoa(unescape(encodeURIComponent(input)));
		}

		input = escape(input);
		var output = "";
		var chr1, chr2, chr3: any = "";
		var enc1, enc2, enc3, enc4: any = "";
		var i = 0;

		do {
			chr1 = input.charCodeAt(i++);
			chr2 = input.charCodeAt(i++);
			chr3 = input.charCodeAt(i++);

			enc1 = chr1 >> 2;
			enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
			enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
			enc4 = chr3 & 63;

			if (isNaN(chr2)) {
				enc3 = enc4 = 64;
			} else if (isNaN(chr3)) {
				enc4 = 64;
			}

			output = output +
				this.keyStr.charAt(enc1) +
				this.keyStr.charAt(enc2) +
				this.keyStr.charAt(enc3) +
				this.keyStr.charAt(enc4);
			chr1 = chr2 = chr3 = "";
			enc1 = enc2 = enc3 = enc4 = "";
		} while (i < input.length);

		return output;
	}
}