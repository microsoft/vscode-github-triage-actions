// A bunch of types for the VS Code API. Mostly lifted straight from
// https://github.com/microsoft/vscode-tools/blob/1b3bc9961a4e4305560fe8d20c7c845884f2b1a4/src/common/src/team.ts

export enum Platform {
	MAC = 1,
	WINDOWS,
	LINUX,
	IPAD,
}

export type Region = 'Redmond' | 'Zurich';

export enum Role {
	CONTENT_DEVELOPER = 'Content Developer',
	DEVELOPER = 'Developer',
	DESIGNER = 'Designer',
	ENGINEERING_MANAGER = 'Engineering Manager',
	PROGRAM_MANAGER = 'Program Manager',
	OTHER = 'Other',
}

// Note: referened by triage bot to find triagers who are not "NOT_AVAILABLE", please make updates there too :)
// https://github.com/microsoft/vscode-tools/blob/main/src/common/src/team.ts#L21
export enum Availability {
	FULL = 1,
	HALF,
	NOT_AVAILABLE,
}

export interface ITeamMember {
	id: string;
	platforms: Platform[];
	team: Region;
	role: Role;
	availability: Availability;
	duties?: string[];
	email?: string;
	slack?: string;
}

export const TRIAGE_DUTY = 'triage';
export const ENDGAME_DUTY = 'endgame';
export const TESTING_DUTY = 'testing';
export const BUILD_DUTY = 'build';
export const TWITTER_DUTY = 'twitter';
export const DISCUSSIONS_DUTY = 'discussions';

export enum RotatingMode {
	NONE,
	WEEKLY = 'weekly',
	MONTHLY = 'monthly',
}

export interface IDuty {
	name: string;
	description: string;
	rotating: RotatingMode;
	rotateLocations: boolean;
	needsBuddy: boolean;
}

export interface IDutyAssignment {
	id: string;
	duty: string;
	comparableId: number;
	name: string;
	champ: string;
	buddy?: string;
	comment?: string;
}

export interface IDutyAssignmentsDto {
	previous: IDutyAssignment[];
	assignments: IDutyAssignment[];
}
