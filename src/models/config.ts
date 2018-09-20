import { FilesPayload } from "./files-payload";
import { SdkCallbacks } from "./sdk-callbacks";
import { ConnectedDevices } from "./connected-devices";
import { Device } from "./device";

export class Config {
	pubnubPublishKey: string;
	pubnubSubscribeKey: string;
	/**
	 * Can be playground or cli
	 */
	msvKey: string;
	/**
	 * Can be staging, uat or live
	 */
	msvEnv: string;
	callbacks: SdkCallbacks;
	getInitialFiles: (device?: Device) => Promise<FilesPayload>;
	instanceId?: string;
	connectedDevices?: ConnectedDevices;
}