import * as axios from "axios";
import { data } from "../preview-app-versions";

export class PreviewAppVersionsService {
	private static GET_VERSIONS_DATA_URL = "https://raw.githubusercontent.com/telerik/nativescript-preview-sdk/master/src/preview-app-versions.js";

	public validMsvKeys = ["cli", "playground"];
	public validMsvEnvs = ["staging", "uat", "live"];

	public async getMinSupportedVersions(key: string, env: string): Promise<{ android: number, ios: number }> {
		const response = await this.get();
		const result = this.parseResponse(response) || data;
		return result[env][key];
	}

	private async get(): Promise<any> {
		return new Promise(resolve => {
			(<any>axios).get(PreviewAppVersionsService.GET_VERSIONS_DATA_URL)
				.then(response => resolve(response))
				.catch(err => resolve(null));
		});
	}

	private parseResponse(response: any) {
		try {
			const parsedResponse = this.parseResponseCore(response.data);
			return JSON.parse(parsedResponse);
		} catch (err) { }

		return null;
	}

	private parseResponseCore(response: any): string {
		const parts = response.split("\n");
		// Replace first row with {
		parts[0] = "{ ";
		let result = parts.join("\n");
		// Remove last symbol - ;
		result = result.substr(0, result.length - 1);

		return result;
	}
}