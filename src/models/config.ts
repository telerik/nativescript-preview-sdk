import { FilePayload } from "./file-payload";
import { SdkCallbacks } from "./sdk-callbacks";
import { ConnectedDevices } from "./connected-devices";

export class Config {
	instanceId: string;
	getInitialFiles: () => FilePayload[];
	callbacks: SdkCallbacks
	pKey: string;
	sKey: string;
	msviOS: number;
    msvAndroid: number;
    connectedDevices: ConnectedDevices;
}