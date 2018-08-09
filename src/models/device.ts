export class Device {
	id: string;
	platform: string;
	model: string;
	name: string;
	osVersion: string;
	previewAppVersion: string;
	runtimeVersion: string;
	plugins?: string;
	pluginsExpanded?: boolean;
}
