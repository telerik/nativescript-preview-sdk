import { DeviceConnectedMessage } from "./device-connected-message";
import { Device } from "./device";

export class DeviceCallbacks {
	onLogMessage: (log: string, deviceName: string) => void;
	onRestartMessage: () => void;
	onUncaughtErrorMessage: () => void;
	onDeviceConnected: (device: Device) => void;
	onDeviceConnectedMessage: (deviceConnectedMessage: DeviceConnectedMessage) => void;
	onDevicesPresence: (devices: Device[]) => void;
	onSendingChange: (sending: boolean) => void;
}
