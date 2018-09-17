import { FilesPayload } from "./files-payload";
import { SdkCallbacks } from "./sdk-callbacks";
import { ConnectedDevices } from "./connected-devices";
import { Device } from "./device";

export class Config {
	pubnubPublishKey: string;
	pubnubSubscribeKey: string;
	callbacks: SdkCallbacks;
	getInitialFiles: (device?: Device) => Promise<FilesPayload>;
	instanceId?: string;
	connectedDevices?: ConnectedDevices;
}