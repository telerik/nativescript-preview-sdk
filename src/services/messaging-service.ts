import { HelpersService } from "./helpers-service";
import { DevicesService } from "./devices-service";
import { Config } from "../models/config";
import { FileChunk } from "../models/file-chunk";
import { DeviceConnectedMessage } from "../models/device-connected-message";
import { Constants } from "../constants";
import { Device } from "../models/device";
import { HereNowResponse } from "../models/here-now-response";
import { DevicePlatform } from "../models/device-platform";
import { FilePayload } from "../models/file-payload";
import { FilesPayload } from "../models/files-payload";
import * as PubNub from "pubnub";
import { SdkCallbacks } from "../models/sdk-callbacks";
import { SendFilesStatus } from "../models/send-files-status";

export class MessagingService {
	private static PubNubInitialized = false;

	private pubNub: PubNub;
	private pubNubListenerParams: PubNub.ListenerParameters;
	private pubNubSubscribeParams: PubNub.SubscribeParameters;
	private connectedDevicesTimeout: any;
	private config: Config;
	private helpersService: HelpersService;
	private devicesService: DevicesService;

	constructor() {
		this.helpersService = new HelpersService();
		this.devicesService = new DevicesService(this.helpersService);
	}

	public initialize(config: Config): string {
		this.config = config;
		this.ensureValidConfig();

		if (MessagingService.PubNubInitialized) {
			return;
		}

		this.pubNub = new PubNub({
			publishKey: this.config.pubnubPublishKey,
			subscribeKey: this.config.pubnubSubscribeKey,
			ssl: true,
			restore: true
		});

		this.pubNubListenerParams = {
			presence: (presenceEvent: any) => {
				this.getConnectedDevicesDelayed(presenceEvent, 5000, 0);
			},
			message: (data: any) => {
				if (data.message.type == "send files") {
					this.handleSendInitialFiles(data, this.config.instanceId, 0);
				} else if (data.message.type == "restart app") {
					this.config.callbacks.onLogSdkMessage(`${this.config.instanceId} message received: restart app`);
					this.config.callbacks.onRestartMessage();
				} else if (data.message.type == "log message") {
					let deviceName = data.message.deviceName;
					if (!deviceName) {
						let senderDevice = this.config.connectedDevices[data.publisher];
						if (senderDevice) {
							let deviceInfo = this.devicesService.get(senderDevice);
							deviceName = deviceInfo.name;
						}
					}

					let logText = data.message.log;
					if (deviceName) {
						logText = `[${deviceName}]: ${logText}`;
					}

					this.config.callbacks.onLogSdkMessage(`${this.config.instanceId} message received: log message ${logText}`);
					this.config.callbacks.onLogMessage(data.message.log, deviceName);
				} else if (data.message.type == "uncaught error") {
					this.config.callbacks.onLogSdkMessage(`${this.config.instanceId} message received: uncaught error`);
					this.config.callbacks.onUncaughtErrorMessage();
				} else if (data.message.type == "ack changes") {
					this.config.callbacks.onLogSdkMessage(`${this.config.instanceId} message received: ack changes`);
				} else if (data.message.type == "device connected") {
					let deviceConnectedMessage: DeviceConnectedMessage = data.message;
					this.config.connectedDevices[data.publisher] = deviceConnectedMessage;
					this.config.callbacks.onConnectedDevicesChange(this.config.connectedDevices);
					this.config.callbacks.onDeviceConnectedMessage(deviceConnectedMessage);
					this.config.callbacks.onDeviceConnected(this.devicesService.get(deviceConnectedMessage));
				}
			}
		};
		this.pubNub.addListener(this.pubNubListenerParams);

		this.pubNubSubscribeParams = {
			channels: [
				this.getBrowserChannel(this.config.instanceId),
				`${this.getDevicesChannel(this.config.instanceId)}-pnpres`
			],
			withPresence: true
		};
		this.pubNub.subscribe(this.pubNubSubscribeParams);

		MessagingService.PubNubInitialized = true;

		return this.config.instanceId;
	}

	public stop() {
		this.pubNub.removeListener(this.pubNubListenerParams);
		this.pubNub.unsubscribe(this.pubNubSubscribeParams);
		this.pubNub.stop();
		clearTimeout(this.connectedDevicesTimeout);
	}

	public applyChanges(instanceId: string, filesPayload: FilesPayload, done: (err: Error) => void): void {
		this.sendFilesInChunks(this.getDevicesChannel(instanceId), "files chunk", filesPayload, filesPayload.deviceId)
			.then(() => done(null))
			.catch(e => done(e));
	}

	private ensureValidConfig() {
		this.config.instanceId = this.config.instanceId || this.helpersService.shortId();
		this.config.connectedDevices = this.config.connectedDevices || {};
		this.config.getInitialFiles = this.config.getInitialFiles || (() => new Promise<FilesPayload>((resolve) => { resolve({ files: [], platform: ""}); }));
		this.config.callbacks = this.config.callbacks || <SdkCallbacks>{};
		this.config.callbacks.onConnectedDevicesChange = this.config.callbacks.onConnectedDevicesChange || (() => { });
		this.config.callbacks.onDeviceConnectedMessage = this.config.callbacks.onDeviceConnectedMessage || (() => { });
		this.config.callbacks.onDeviceConnected = this.config.callbacks.onDeviceConnected || (() => { });
		this.config.callbacks.onDevicesPresence = this.config.callbacks.onDevicesPresence || (() => { });
		this.config.callbacks.onLogMessage = this.config.callbacks.onLogMessage || (() => { });
		this.config.callbacks.onLogSdkMessage = this.config.callbacks.onLogSdkMessage || (() => { });
		this.config.callbacks.onRestartMessage = this.config.callbacks.onRestartMessage || (() => { });
		this.config.callbacks.onSendingChange = this.config.callbacks.onSendingChange || (() => { });
		this.config.callbacks.onUncaughtErrorMessage = this.config.callbacks.onUncaughtErrorMessage || (() => { });
		if (!this.config.pubnubPublishKey) {
			throw new Error("Pubnub publish key is required when creating a messaging service.");
		}

		if (!this.config.pubnubSubscribeKey) {
			throw new Error("Pubnub subscribe key is required when creating a messaging service.");
		}

		if (!this.config.callbacks.onBiggerFilesUpload) {
			throw new Error("onBiggerFilesUpload callback is required when creating a messaging service.");
		}
	}

	sendInitialFiles(instanceId: string) {
		this.handleSendInitialFiles({}, instanceId, 0, true);
	}

	getConnectedDevices(instanceId: string): Promise<Device[]> {
		let devicesChannel = this.getDevicesChannel(instanceId);
		return new Promise((resolve, reject) => {
			let request = {
				channels: [devicesChannel],
				includeUUIDs: true,
				includeState: true
			};
			this.pubNub.hereNow(request, (status, response: HereNowResponse) => {
				if (status && status.error) {
					return reject();
				}

				if (!response || !response.channels || response.totalChannels < 1) {
					this.config.callbacks.onDevicesPresence([]);
					return resolve([]);
				}

				let channelInfo = response.channels[devicesChannel];
				if (!channelInfo) {
					this.config.callbacks.onDevicesPresence([]);
					return resolve([]);
				}

				let occupants = channelInfo.occupants || [];
				let deviceIds = occupants
					.filter(x => typeof x.uuid != "undefined" && x.uuid != null)
					.map(x => x.uuid);
				if (!deviceIds || deviceIds.length < 1) {
					this.config.callbacks.onDevicesPresence([]);
					return resolve([]);
				}

				let devices = deviceIds
					.map(id => this.config.connectedDevices[id])
					.filter(x => typeof x != "undefined" && x != null)
					.map(x => this.devicesService.get(x))
					.sort((d1, d2) => {
						if (d1.model < d2.model) {
							return -1;
						} else if (d1.model > d2.model) {
							return 1;
						}
						return 0;
					});

				this.config.callbacks.onDevicesPresence(devices);
				return resolve(devices);
			});
		});
	}

	// TODO: check on CLI livesync as we don't have control on file upload
	exceedsMaximumTreeSize(additionalFiles?: FilePayload[]): Promise<boolean> {
		return new Promise((resolve) => {
			this.config.getInitialFiles().then((initialPayload) => {
				let files = initialPayload.files.concat(additionalFiles || []);
				let chunks = this.getChunks(files);

				resolve(chunks.length > 650);
			});
		});
	}

	private sendFilesInChunks(channel: string, messageType: string, filesPayload: FilesPayload, deviceIdMeta?: string): Promise<SendFilesStatus> {
		let chunks = this.getChunks(filesPayload.files);
		this.config.callbacks.onSendingChange(true);
		return new Promise((resolve, reject) => {
			this.getPublishPromise(channel, messageType, chunks, deviceIdMeta, filesPayload.platform)
				.then(() => {
					this.config.callbacks.onSendingChange(false);
					resolve({ error: false });
				})
				.catch(err => {
					this.config.callbacks.onSendingChange(false);
					reject(err);
				});
		});
	}

	private getPublishPromise(channel: string, messageType: string, chunks: FileChunk[], deviceIdMeta: string, platform: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!chunks.length) {
				return resolve();
			}

			let meta = this.getPubNubMetaData(deviceIdMeta, platform);

			if (chunks.length === 1) {
				this.pubNub.publish({
					message: {
						"type": messageType,
						"id": chunks[0].id,
						"index": chunks[0].index,
						"total": chunks[0].total,
						"data": chunks[0].data
					},
					channel: channel,
					meta: meta
				}, (status, response) => {
					if (status.error) {
						reject(status);
					} else {
						resolve();
					}
				});
			} else {
				let data = chunks.map(chunk => chunk.data);

				this.pubNub.publish({
					message: { "type": "large session" },
					channel: channel,
					meta: meta
				});

				this.config.callbacks.onBiggerFilesUpload(data.join(""), (uploadedFilesLocation, error) => {
					if (error) {
						reject(error);
					} else {
						this.pubNub.publish({
							message: {
								"type": messageType,
								"remoteDataUrl": uploadedFilesLocation
							},
							channel: channel,
							meta: meta
						}, (status) => {
							if (status.error) {
								reject(status.error);
							} else {
								resolve();
							}
						});
					}
				});
			}
		});
	}

	private getPubNubMetaData(deviceIdMeta?: string, targetPlatform: string = DevicePlatform.All): any {
		let meta: any = {
			msvi: Constants.МsviOS,
			msva: Constants.MsvAndroid,
			platform: targetPlatform
		};
		if (deviceIdMeta) {
			meta = {
				msvi: Number.MAX_SAFE_INTEGER,
				msva: Number.MAX_SAFE_INTEGER,
				di: deviceIdMeta
			}
		}

		return meta;
	}

	private getChunks(payload: FilePayload[]): FileChunk[] {
		let serializedPayload = JSON.stringify(payload);
		let base64Encoded = this.helpersService.base64Encode(serializedPayload);

		let parts = base64Encoded.match(/.{1,30000}/g);
		let chunks: FileChunk[] = [];
		let id = this.helpersService.shortId();
		parts.forEach((part: string, index: number) => {
			chunks.push({
				id: id,
				index: index,
				total: parts.length,
				data: part
			});
		});

		return chunks;
	}

	private handleSendInitialFiles(data: any, instanceId: string, retries: number, skipDeviceCheck: boolean = false): void {
		if (retries > 10) {
			this.config.callbacks.onLogSdkMessage(`${instanceId} Exception: didn't receive device connected message after ${retries} retries`);
			return;
		}

		if (!skipDeviceCheck) {
			let device = this.config.connectedDevices[data.publisher];
			if (!device) {
				setTimeout(() => this.handleSendInitialFiles(data, instanceId, retries++), 1000);
				return;
			}

			let isAndroid = this.helpersService.areCaseInsensitiveEqual(device.platform, "android");
			let minimumSupportedVersion = isAndroid ? Constants.MsvAndroid : Constants.МsviOS;
			if (!device.version || !device.platform || device.version < minimumSupportedVersion) {
				let deprecatedAppFiles = this.getDeprecatedAppContent();
				this.sendFilesInChunks(this.getDevicesChannel(instanceId), "initial sync chunk", { files: deprecatedAppFiles }, data.publisher).then(() => { });
				return;
			}

			this.config.callbacks.onLogSdkMessage(`${instanceId} message received: send files`);
		}

		this.config.getInitialFiles().then((initialPayload) => {
			this.sendFilesInChunks(this.getDevicesChannel(instanceId), "initial sync chunk", initialPayload).then(() => { });
		});
	}

	private getConnectedDevicesDelayed(presenceEvent: any, delay: number, retryCount: number): void {
		this.connectedDevicesTimeout = setTimeout(() => {
			clearTimeout(this.connectedDevicesTimeout);
			this.getConnectedDevices(this.config.instanceId).then(devices => {
				let shouldRetry =
					!(devices || []).find(d => d.id == presenceEvent.uuid) &&
					presenceEvent.action &&
					this.helpersService.areCaseInsensitiveEqual("join", presenceEvent.action) &&
					presenceEvent.channel &&
					!presenceEvent.channel.startsWith("b-");

				if (shouldRetry && retryCount < 5) {
					this.getConnectedDevicesDelayed(presenceEvent, 2000, retryCount++);
				}
			});
		}, delay);
	}

	private getDeprecatedAppContent(): FilePayload[] {
		return [
			{
				event: "change",
				file: "package.json",
				fileContents: `{"main":"_deprecated-error.js"}`
			},
			{
				event: "change",
				file: "_deprecated-error.js",
				fileContents: `var application = require("application"),
	Page = require("tns-core-modules/ui/page").Page,
	ActionBar = require("tns-core-modules/ui/action-bar").ActionBar,
	Label = require("tns-core-modules/ui/label").Label,
	Image = require("tns-core-modules/ui/image").Image,
	Button = require("tns-core-modules/ui/button").Button,
	StackLayout = require("tns-core-modules/ui/layouts/stack-layout").StackLayout,
	FlexboxLayout = require("tns-core-modules/ui/layouts/flexbox-layout").FlexboxLayout,
	utils = require("utils/utils");

application.start({
	create: () => {
		let page = new Page();
		page.css = ".main-container { background-color: #0c2834; flex-direction: column; color: #fff; align-items: center; justify-content: center; } .header { padding-top: 50%; font-size: 24; } .labelContainer { padding: 20% 50% 60% 50%; } .label { color: #a0b4bd; text-align: center; } .button { background-color: #4456fe; width: 70%; height: 120px; }";

		let actionBar = new ActionBar();
		actionBar.title = "Update";
		actionBar.color = "#fff";
		actionBar.backgroundColor = "#0c2834";
		page.actionBar = actionBar;

		let layout = new FlexboxLayout();
		layout.cssClasses.add("main-container");

		let image = new Image();
		image.src = "data:image/png;base64,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";
		image.width = "20%";

		let header = new Label();
		header.textWrap = true;
		header.text = "App update is required";
		header.cssClasses.add("header");

		let labelContainer = new StackLayout();
		labelContainer.cssClasses.add("labelContainer");
		let label = new Label();
		label.textWrap = true;
		label.text = "Update to the latest version and scan the QR code again.";
		label.cssClasses.add("label");
		labelContainer.addChild(label);

		let button = new Button();
		button.text = "Update";
		button.cssClasses.add("button");
		button.on(Button.tapEvent, args => {
			if (application.android) {
				var context = utils.ad.getApplicationContext();
				var Intent = android.content.Intent;
				var intent = new Intent(Intent.ACTION_VIEW);
				intent.setData(android.net.Uri.parse("https://play.google.com/store/apps/details?id=${Constants.PreviewGooglePlayId}"));
				intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
				context.startActivity(intent);
			} else if (application.ios) {
				var sharedApplication = utils.ios.getter(UIApplication, UIApplication.sharedApplication);
				var storeUrl = NSURL.URLWithString("itms-apps://itunes.apple.com/app/id${Constants.PreviewAppStoreId}");
				if (sharedApplication.canOpenURL(storeUrl)) {
					sharedApplication.openURL(storeUrl);
				} else {
					storeUrl = NSURL.URLWithString("https://itunes.apple.com/app/id${Constants.PreviewAppStoreId}");
					sharedApplication.openURL(storeUrl);
				}
			}
		});

		layout.addChild(image);
		layout.addChild(header);
		layout.addChild(labelContainer);
		layout.addChild(button);

		page.content = layout;

		return page;
	}
});`
			}
		];
	}

	private getDevicesChannel(instanceId: string): string {
		return `m-ch-${instanceId}`;
	}

	private getBrowserChannel(instanceId: string): string {
		return `b-ch-${instanceId}`;
	}
}
