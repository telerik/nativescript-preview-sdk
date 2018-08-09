import { FilePayload } from "./file-payload";
import { SdkCallbacks } from "./sdk-callbacks";
import { ConnectedDevices } from "./connected-devices";

export class Config {
	instanceId: string;
	getInitialFiles: () => FilePayload[];
	callbacks: SdkCallbacks
	pubnubPublishKey: string;
	pubnubSubscribeKey: string;
    connectedDevices: ConnectedDevices;
}