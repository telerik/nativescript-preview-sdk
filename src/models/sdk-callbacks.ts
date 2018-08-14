import { DeviceCallbacks } from "./device-callbacks";
import { ConnectedDevices } from "./connected-devices";

export class SdkCallbacks extends DeviceCallbacks {
	onLogSdkMessage: (log: string) => void;
	onConnectedDevicesChange: (connectedDevices: ConnectedDevices) => void;
}
