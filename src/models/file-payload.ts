export class FilePayload {
	event: string;
	file: string;
	originalFile?: string;
	fileContents: string;
	binary?: boolean;
	hash?: string;
	hmrHash?: string;
};
