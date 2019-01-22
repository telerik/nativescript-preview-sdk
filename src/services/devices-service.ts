import { DeviceConnectedMessage } from "../models/device-connected-message";
import { Device } from "../models/device";
import { HelpersService } from "./helpers-service";

export class DevicesService {
	constructor(private helpers: HelpersService) {
	}

	get(message: DeviceConnectedMessage): Device {
		let isAndroid = this.helpers.areCaseInsensitiveEqual(message.platform, "android");
		let device = new Device();
		device.id = message.deviceId;
		device.uniqueId = message.deviceUniqueId;
		device.model = this.getDeviceName(message);
		device.name = message.name || device.model;
		device.platform = message.platform;
		device.previewAppVersion = message.friendlyVersion || (message.version ? message.version.toString() : null);
		device.osVersion = `${isAndroid ? "Android" : "iOS"} ${message.osVersion}`;
		device.plugins = this.getPlugins(message);
		device.runtimeVersion = this.getRuntimeVersion(message);
		return device;
	}

	private getDeviceName(message: DeviceConnectedMessage): string {
		if (!message || !message.deviceName) {
			return "";
		}

		if (this.helpers.areCaseInsensitiveEqual(message.platform, "android")) {
			return message.deviceName;
		}

		switch (message.deviceName.toLowerCase()) {
			case "i386": return "Simulator";
			case "x86_64": return "Simulator";
			case "ipod1,1": return "iPod Touch";
			case "ipod2,1": return "iPod Touch";
			case "ipod3,1": return "iPod Touch";
			case "ipod4,1": return "iPod Touch";
			case "ipod7,1": return "iPod Touch";
			case "iphone1,1": return "iPhone";
			case "iphone1,2": return "iPhone";
			case "iphone2,1": return "iPhone";
			case "ipad1,1": return "iPad";
			case "ipad2,1": return "iPad 2";
			case "ipad3,1": return "iPad";
			case "iphone3,1": return "iPhone 4";
			case "iphone3,3": return "iPhone 4";
			case "iphone4,1": return "iPhone 4S";
			case "iphone5,1": return "iPhone 5";
			case "iphone5,2": return "iPhone 5";
			case "ipad3,4": return "iPad";
			case "ipad2,5": return "iPad Mini";
			case "iphone5,3": return "iPhone 5c";
			case "iphone5,4": return "iPhone 5c";
			case "iphone6,1": return "iPhone 5s";
			case "iphone6,2": return "iPhone 5s";
			case "iphone7,1": return "iPhone 6 Plus";
			case "iphone7,2": return "iPhone 6";
			case "iphone8,1": return "iPhone 6S";
			case "iphone8,2": return "iPhone 6S Plus";
			case "iphone8,4": return "iPhone SE";
			case "iphone9,1": return "iPhone 7";
			case "iphone9,3": return "iPhone 7";
			case "iphone9,2": return "iPhone 7 Plus";
			case "iphone9,4": return "iPhone 7 Plus";
			case "iphone10,1": return "iPhone 8";
			case "iphone10,4": return "iPhone 8";
			case "iphone10,2": return "iPhone 8 Plus";
			case "iphone10,5": return "iPhone 8 Plus";
			case "iphone10,3": return "iPhone X";
			case "iphone10,6": return "iPhone X";
			case "ipad4,1": return "iPad Air";
			case "ipad4,2": return "iPad Air";
			case "ipad4,4": return "iPad Mini";
			case "ipad4,5": return "iPad Mini";
			case "ipad4,7": return "iPad Mini";
			case "ipad6,7": return "iPad Pro (12.9\")";
			case "ipad6,8": return "iPad Pro (12.9\")";
			case "ipad6,3": return "iPad Pro (9.7\")";
			case "ipad6,4": return "iPad Pro (9.7\")";
			default: return "iOS device";
		}
	}

	private getRuntimeVersion(message: DeviceConnectedMessage): string {
		if (!message.package) {
			return "";
		}

		try {
			var parsedPackage = JSON.parse(message.package);
			if (!parsedPackage.nativescript) {
				return "";
			}

			let platformKey = this.helpers.areCaseInsensitiveEqual("android", message.platform) ? "tns-android" : "tns-ios";
			let platform = parsedPackage.nativescript[platformKey];
			if (!platform) {
				return "";
			}

			return platform["version"] || "";
		} catch (e) {
			return "";
		}
	}

	private getPlugins(message: DeviceConnectedMessage): string {
		if (!message.package) {
			return "";
		}

		try {
			var parsedPackage = JSON.parse(message.package);
			if (!parsedPackage.dependencies) {
				return "";
			}

			delete parsedPackage.dependencies["PlayLiveSync"];

			return JSON.stringify(parsedPackage.dependencies, null, 2);
		} catch (e) {
			return "";
		}
	}
}
