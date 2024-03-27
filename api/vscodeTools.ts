import { ServiceClient } from '@azure/core-http';
import { AzureCliCredential } from '@azure/identity';
import { TRIAGE_DUTY, type ITeamMember, Availability } from './vscodeToolsTypes';

const API_URL = 'https://tools.code.visualstudio.com/api';
const CREDENTIAL_SCOPES = ['api://3834c68c-adcc-4ad8-818a-8fca4cc260be/.default'];

export class VSCodeToolsAPIManager {
	private readonly serviceClient: ServiceClient;

	constructor() {
		const credential = new AzureCliCredential();
		this.serviceClient = new ServiceClient(credential, { credentialScopes: CREDENTIAL_SCOPES });
	}

	async getTeamMembers() {
		return this.fetchDataFromAPI<ITeamMember[]>(`${API_URL}/team/members`);
	}

	async getTriagerGitHubIds(): Promise<string[]> {
		const members = await this.getTeamMembers();
		return members
			.filter(
				(member) =>
					member.duties?.includes(TRIAGE_DUTY) &&
					member.availability !== Availability.NOT_AVAILABLE,
			)
			.map((member) => member.id);
	}

	async getTeamMemberFromGitHubId(gitHubId: string) {
		const teamMembers = await this.getTeamMembers();
		return teamMembers.find((member) => member.id === gitHubId);
	}

	private async fetchDataFromAPI<T>(url: string): Promise<T> {
		const response = await this.serviceClient.sendRequest({ url, method: 'GET' });
		// TODO @lramos15 Fix this as throwing is not the best way to handle errors
		if (!response.bodyAsText) {
			throw new Error('No body in response');
		}
		return JSON.parse(response.bodyAsText);
	}
}
