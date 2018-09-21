import * as shortId from "shortid";
import * as nodeBtoa from "btoa";

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
        if(!this.isBrowser()) {
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
		}
		else {
			return nodeBtoa(unescape(encodeURIComponent(input)));
		}
	}
}