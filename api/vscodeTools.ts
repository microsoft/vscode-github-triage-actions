import { ServiceClient } from '@azure/core-http';
import { ClientSecretCredential } from '@azure/identity';
import type { ITeamMember } from './vscodeToolsTypes';

const API_URL = 'https://tools.code.visualstudio.com/api';

export class VSCodeToolsAPIManager {
	private readonly serviceClient: ServiceClient;
	constructor(config: { tenantId: string; clientId: string; clientSecret: string; clientScope: string }) {
		const credential = new ClientSecretCredential(config.tenantId, config.clientId, config.clientSecret);
		this.serviceClient = new ServiceClient(credential, { credentialScopes: [config.clientScope] });
	}

	async getTeamMembers() {
		return this.fetchDataFromAPI<ITeamMember[]>(`${API_URL}/team/members`);
	}

	async getTriagerGitHubIds(): Promise<string[]> {
		const members = await this.getTeamMembers();
		return members.filter((member) => member.duties?.includes('triage')).map((member) => member.id);
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
