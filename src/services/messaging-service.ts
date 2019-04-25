import * as PubNub from "pubnub";
import * as msgpack from "msgpack-lite";

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
import { SdkCallbacks } from "../models/sdk-callbacks";
import { SendFilesStatus } from "../models/send-files-status";
import { PreviewAppVersionsService } from "./preview-app-versions-service";
import { AppContentManager } from "./app-content-manager";

export class MessagingService {
	// NOTE: The current LARGE_SESSIONS_PROTOCOL implementation is suitable for the Playground because there's a limitation
	// on the maximum size of a given session. To take full advantage of the MessagePack streaming mechanism we should
	// provide an alternative implementation for the CLI which works directly with file streams and avoid loading their serialized
	// content in-memory. We need to revisit the "sendFilesInChunks" method which currently works with the FilesPayload parameter.
	public static LARGE_SESSIONS_PROTOCOL = "msg-pack";
	private static HMR_HASH_PATTERN = new RegExp("var\\s+hotCurrentHash\\s+=\\s*\\\"([^\"]*)\\\";", "g");
	private static PubNubInitialized = false;

	private pubNub: PubNub;
	private pubNubListenerParams: PubNub.ListenerParameters;
	private pubNubSubscribeParams: PubNub.SubscribeParameters;
	private connectedDevicesTimeouts: { [id: string]: number };
	private config: Config;
	private helpersService: HelpersService;
	private devicesService: DevicesService;
	private previewAppVersionsService: PreviewAppVersionsService;
	private appContentManager: AppContentManager;
	private minSupportedVersions: { android: number, ios: number };

	constructor() {
		this.helpersService = new HelpersService();
		this.devicesService = new DevicesService(this.helpersService);
		this.previewAppVersionsService = new PreviewAppVersionsService();
		this.appContentManager = new AppContentManager();
		this.connectedDevicesTimeouts = {};
	}

	public async initialize(config: Config): Promise<string> {
		this.config = config;
		this.ensureValidConfig();

		if (MessagingService.PubNubInitialized) {
			return;
		}

		this.minSupportedVersions = await this.previewAppVersionsService.getMinSupportedVersions(this.config.msvKey, this.config.msvEnv);

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
					this.config.callbacks.onLogMessage(data.message.log, deviceName, data.publisher);
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
		if (MessagingService.PubNubInitialized) {
			this.pubNub.removeListener(this.pubNubListenerParams);
			this.pubNub.unsubscribe(this.pubNubSubscribeParams);
			this.pubNub.stop();
			MessagingService.PubNubInitialized = false;
			for (let uuid in this.connectedDevicesTimeouts) {
				clearTimeout(this.connectedDevicesTimeouts[uuid]);
			}
		}
	}

	public applyChanges(instanceId: string, filesPayload: FilesPayload, done: (err: Error) => void): void {
		this.sendFilesInChunks(this.getDevicesChannel(instanceId), "files chunk", filesPayload, filesPayload.deviceId)
			.then(() => done(null))
			.catch(e => done(e));
	}

	private ensureValidConfig() {
		this.config.instanceId = this.config.instanceId || this.helpersService.shortId();
		this.config.connectedDevices = this.config.connectedDevices || {};
		this.config.getInitialFiles = this.config.getInitialFiles || (() => new Promise<FilesPayload>((resolve) => { resolve({ files: [], platform: "" }); }));
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

		if (!this.config.msvKey) {
			throw new Error(`msvKey is required when getting min supported versions of preview apps. Valid values are: ${this.previewAppVersionsService.validMsvEnvs.join(", ")}.`);
		}

		if (!this.config.msvEnv) {
			throw new Error(`msvEnv is required when getting min supported versions of preview apps. Valid values are: ${this.previewAppVersionsService.validMsvEnvs.join(", ")}.`);
		}

		if (!this.previewAppVersionsService.validMsvKeys.find(msvKey => this.helpersService.areCaseInsensitiveEqual(msvKey, this.config.msvKey))) {
			throw new Error(`Invalid msvKey ${this.config.msvKey}. Valid values are: ${this.previewAppVersionsService.validMsvEnvs.join(", ")}.`);
		}

		if (!this.previewAppVersionsService.validMsvEnvs.find(env => this.helpersService.areCaseInsensitiveEqual(env, this.config.msvEnv))) {
			throw new Error(`Invalid msvEnv ${this.config.msvEnv}. Valid values are: ${this.previewAppVersionsService.validMsvEnvs.join(", ")}.`);
		}
	}

	sendInitialFiles(instanceId: string, hmrMode?: number) {
		this.handleSendInitialFiles({}, instanceId, 0, true, hmrMode);
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
		let finalFilesPayload = this.getFinalFilesPayload(filesPayload);
		let chunks = this.getChunks(finalFilesPayload);
		this.config.callbacks.onSendingChange(true);
		return new Promise((resolve, reject) => {
			this.getPublishPromise(channel, messageType, chunks, deviceIdMeta, filesPayload.platform, filesPayload.hmrMode)
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

	private getFinalFilesPayload(filesPayload: FilesPayload) {
		let finalFiles = filesPayload.files;
		var appPackageJson = finalFiles.find((filePayload) => filePayload.file === "package.json");
		if (appPackageJson) {
			const jsonContent = JSON.parse(appPackageJson.fileContents);
			jsonContent.android = jsonContent.android || {};
			jsonContent.android.forceLog = true;
			appPackageJson.fileContents = JSON.stringify(jsonContent);
		}

		return finalFiles;
	}

	private getPublishPromise(channel: string, messageType: string, chunks: FileChunk[], deviceIdMeta: string, platform: string, hmrMode?: number): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!chunks.length) {
				return resolve();
			}

			let meta = this.getPubNubMetaData(deviceIdMeta, platform, hmrMode);

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
				this.pubNub.publish({
					message: { "type": "large session" },
					channel: channel,
					meta: meta
				});

				let data = chunks.map(chunk => chunk.data).join("");

				let requestBody: Uint8Array;
				if (this.config.largeFilesProtocol === MessagingService.LARGE_SESSIONS_PROTOCOL) {
					let decoded = this.helpersService.base64Decode(data);
					let parts: FilePayload[] = JSON.parse(decoded);

					let options = { codec: msgpack.createCodec({ binarraybuffer: true }) };
					let header = parts.map(part => {
						let result = {
							file: part.file,
							event: part.event,
							binary: part.binary,
							hash: part.binary === true
								? this.helpersService.calculateMD5(this.helpersService.stringToByteArray(part.fileContents, true))
								: this.helpersService.calculateMD5(part.fileContents)
						};

						let hmrHash = this.getHMRHash(part);
						if (hmrHash) {
							result["hmrHash"] = hmrHash;
						}

						return result;
					});
					let encodedHeader = msgpack.encode(header, options);

					let payloads = parts
						.filter(part => part.event == "change" || part.event == "add")
						.map(part => this.helpersService.stringToByteArray(part.fileContents, part.binary).buffer);
					let encodedPayloads = payloads.map(payload => msgpack.encode(payload, options));

					requestBody = this.helpersService.concatenateArrays(encodedHeader, ...encodedPayloads);
				} else {
					requestBody = this.helpersService.stringToByteArray(data);
				}

				this.config.callbacks.onBiggerFilesUpload(requestBody, (uploadedFilesLocation, error) => {
					if (error) {
						reject(error);
					} else {
						let message = {
							"type": messageType,
							"remoteDataUrl": uploadedFilesLocation,
						};

						if (typeof this.config.largeFilesProtocol !== "undefined") {
							message["protocol"] = this.config.largeFilesProtocol;
						}

						this.pubNub.publish({
							message: message,
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

	private getPubNubMetaData(deviceIdMeta?: string, targetPlatform: string = DevicePlatform.All, hmrMode?: number): any {
		let meta: any = {
			msvi: this.minSupportedVersions.ios,
			msva: this.minSupportedVersions.android,
			platform: targetPlatform
		};
		if (deviceIdMeta) {
			meta = {
				msvi: Number.MAX_SAFE_INTEGER,
				msva: Number.MAX_SAFE_INTEGER,
				di: deviceIdMeta,
				platform: targetPlatform
			}
		}
		if (hmrMode === 0 || hmrMode === 1) {
			meta.hmrMode = hmrMode;
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

	private async handleSendInitialFiles(data: any, instanceId: string, retries: number, skipDeviceCheck: boolean = false, hmrMode?: number): Promise<void> {
		let device: Device = null;
		if (retries > 10) {
			this.config.callbacks.onLogSdkMessage(`${instanceId} Exception: didn't receive device connected message after ${retries} retries`);
			return;
		}

		const devicesChannel = this.getDevicesChannel(instanceId);

		if (!skipDeviceCheck) {
			let deviceConnectedMessage = this.config.connectedDevices[data.publisher];
			if (!deviceConnectedMessage) {
				setTimeout(() => this.handleSendInitialFiles(data, instanceId, ++retries, false, hmrMode), 1000);
				return;
			}

			device = this.devicesService.get(deviceConnectedMessage);
			const isAndroid = this.helpersService.areCaseInsensitiveEqual(device.platform, "android");
			const minimumSupportedVersion = isAndroid ? this.minSupportedVersions.android : this.minSupportedVersions.ios;
			const showDeprecatedPage = !deviceConnectedMessage.version || !deviceConnectedMessage.platform || deviceConnectedMessage.version < minimumSupportedVersion;
			if (showDeprecatedPage) {
				const payloads = this.appContentManager.getDeprecatedAppPayloads(this.config.previewAppStoreId, this.config.previewAppGooglePlayId);
				await this.showPage(devicesChannel, device, payloads, { hmrMode, publisher: data.publisher });
				return;
			}

			this.config.callbacks.onLogSdkMessage(`${instanceId} message received: send files`);
		}

		const initialPayload = await this.config.getInitialFiles(device);
		if (initialPayload && initialPayload.files && initialPayload.files.length) {
			if (!initialPayload.deviceId && device) {
				initialPayload.deviceId = device.id;
			}

			if (initialPayload.hmrMode === undefined || initialPayload.hmrMode === null) {
				initialPayload.hmrMode = hmrMode;
			}
			await this.sendFilesInChunks(devicesChannel, Constants.InitialSyncMessageType, initialPayload, initialPayload.deviceId);
		}
	}

	private getConnectedDevicesDelayed(presenceEvent: any, delay: number, retryCount: number): void {
		this.connectedDevicesTimeouts[presenceEvent.uuid] = setTimeout(<Function>(() => {
			if (!this.helpersService.isBrowserTabActive()) {
				//Page not visible, retrying in 2 seconds
				return this.getConnectedDevicesDelayed(presenceEvent, 2000, retryCount);
			}

			this.getConnectedDevices(this.config.instanceId).then(devices => {
				let shouldRetry =
					!(devices || []).find(d => d.id == presenceEvent.uuid) &&
					presenceEvent.action &&
					this.helpersService.areCaseInsensitiveEqual("join", presenceEvent.action) &&
					presenceEvent.channel &&
					!presenceEvent.channel.startsWith("b-");

				if (shouldRetry && retryCount < 5) {
					this.getConnectedDevicesDelayed(presenceEvent, 1000 * (retryCount + 1), ++retryCount);
				}
			});
		}), delay);
	}

	private async showPage(devicesChannel: string, device: Device, files: FilePayload[], opts: { hmrMode: number, publisher: string }): Promise<void> {
		const payload = {
			files,
			hmrMode: opts.hmrMode,
			platform: device.platform,
			deviceId: device.id
		};
		await this.sendFilesInChunks(devicesChannel, Constants.InitialSyncMessageType, payload, opts.publisher);
	}

	private getDevicesChannel(instanceId: string): string {
		return `m-ch-${instanceId}`;
	}

	private getBrowserChannel(instanceId: string): string {
		return `b-ch-${instanceId}`;
	}

	private getHMRHash(part: FilePayload): string {
		if (!part || !part.fileContents || !part.file || !part.file.toLowerCase().endsWith("bundle.js")) {
			return null;
		}

		let matches = MessagingService.HMR_HASH_PATTERN.exec(part.fileContents);
		if (!matches || matches.length < 2) {
			return null;
		}

		return matches[1];
	}
}
