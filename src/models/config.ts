import { FilePayload } from "./file-payload";
import { SdkCallbacks } from "./sdk-callbacks";
import { ConnectedDevices } from "./connected-devices";

export class Config {
	pubnubPublishKey: string;
	pubnubSubscribeKey: string;
	callbacks: SdkCallbacks;
	getInitialFiles: () => Promise<FilePayload[]>;
	instanceId?: string;
	connectedDevices?: ConnectedDevices;
}