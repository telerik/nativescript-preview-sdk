export class Occupant {
	uuid: string;
}

export class ChannelInfo {
	name: string;
	occupancy: number;
	occupants: Occupant[];
}

export class HereNowResponse {
	totalChannels: number;
	channels: { [id: string]: ChannelInfo; };
}