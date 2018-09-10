import { FilesPayload } from "./files-payload";
import { SdkCallbacks } from "./sdk-callbacks";
import { ConnectedDevices } from "./connected-devices";

export class Config {
	pubnubPublishKey: string;
	pubnubSubscribeKey: string;
	callbacks: SdkCallbacks;
	getInitialFiles: () => Promise<FilesPayload>;
	instanceId?: string;
	connectedDevices?: ConnectedDevices;
}