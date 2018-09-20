import * as axios from "axios";
import { data } from "../preview-app-versions";

export class PreviewAppVersionsService {
	private static GET_VERSIONS_DATA_URL = "https://raw.githubusercontent.com/telerik/nativescript-preview-sdk/master/src/preview-app-versions.js?token=AAuaxiKOa83eWHeHU_N3C1qPCW1z4rv5ks5brHCBwA%3D%3D";

	public validMsvKeys = ["cli", "playground"];
	public validMsvEnvs = ["sit", "uat", "live"];

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
		let parts = response.split("\n");
		const count = parts.length - 1;
		// Remove first and the last three rows
		parts = parts.filter((part, index) => index !== 0 && index !== count && index !== count - 1 && index !== count - 2);
		parts.unshift("{ ");
		let result = parts.join("\n");
		// Remove last ;
		result = result.substr(0, result.length - 1);

		return result;
	}
}