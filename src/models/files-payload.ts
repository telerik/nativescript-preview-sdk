import { FilePayload } from "./file-payload"

export class FilesPayload {
    files: FilePayload[];
    hmrMode?: number;
    platform?: string;
    deviceId?: string;
};
