import * as shortId from "shortid";
import * as nodeBtoa from "btoa";

declare function escape(s: string): string;
declare function unescape(s: string): string;

export class HelpersService {
	areCaseInsensitiveEqual(value1: string, value2: string): boolean {
		return (value1 || "").toLowerCase() == (value2 || "").toLowerCase();
	}

	shortId(): string {
		return shortId.generate();
	}

	base64Encode(input: string): string {
		if (typeof window !== "undefined") {
			return window.btoa(unescape(encodeURIComponent(input)))
		}
		else {
			return nodeBtoa(unescape(encodeURIComponent(input)));
		}
	}
}