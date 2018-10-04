import * as axios from "axios";
import { fallbackPreviewVersions } from "../preview-app-versions";

export class PreviewAppVersionsService {
	private static GET_VERSIONS_DATA_URL = "https://raw.githubusercontent.com/telerik/nativescript-preview-sdk/master/src/preview-app-versions.js";

	public validMsvKeys = ["cli", "playground", "kinveyStudio"];
	public validMsvEnvs = ["staging", "uat", "live", "test", "production"];

	public async getMinSupportedVersions(key: string, env: string): Promise<{ android: number, ios: number }> {
		const response = await this.get();
		const result = this.parseResponseSafe(response) || fallbackPreviewVersions;
		return result[env][key];
	}

	private async get(): Promise<any> {
		return new Promise(resolve => {
			(<any>axios).get(PreviewAppVersionsService.GET_VERSIONS_DATA_URL)
				.then(response => resolve(response))
				.catch(err => resolve(null));
		});
	}

	private parseResponseSafe(response: any) {
		try {
			const parsedResponse = this.parseResponse(response.data);
			return JSON.parse(parsedResponse);
		} catch (err) { }

		return null;
	}

	private parseResponse(response: any): string {
		const parts = response.split("\n").map(x => x.trim());
		// Replace first row with {
		parts[0] = "{";
		let result = parts.filter(x => x).join("\n");
		// Remove last symbol - ;
		result = result.substr(0, result.length - 1);

		return result;
	}
}
