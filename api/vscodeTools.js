"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VSCodeToolsAPIManager = void 0;
const core_http_1 = require("@azure/core-http");
const identity_1 = require("@azure/identity");
const vscodeToolsTypes_1 = require("./vscodeToolsTypes");
const API_URL = 'https://tools.code.visualstudio.com/api';
function rot13(input) {
    return input.replace(/[a-z]/gi, (letter) => String.fromCharCode(letter.charCodeAt(0) + (letter.toLowerCase() <= 'm' ? 13 : -13)));
}
class VSCodeToolsAPIManager {
    constructor(config) {
        const credential = new identity_1.AzureCliCredential();
        console.log('I DONT EVEN', { credentialScopes: [config.clientScope] });
        console.log('I DONT EVEN b64', rot13(config.clientScope));
        this.serviceClient = new core_http_1.ServiceClient(credential, { credentialScopes: [config.clientScope] });
    }
    async getTeamMembers() {
        return this.fetchDataFromAPI(`${API_URL}/team/members`);
    }
    async getTriagerGitHubIds() {
        const members = await this.getTeamMembers();
        return members
            .filter((member) => {
            var _a;
            return ((_a = member.duties) === null || _a === void 0 ? void 0 : _a.includes(vscodeToolsTypes_1.TRIAGE_DUTY)) &&
                member.availability !== vscodeToolsTypes_1.Availability.NOT_AVAILABLE;
        })
            .map((member) => member.id);
    }
    async getTeamMemberFromGitHubId(gitHubId) {
        const teamMembers = await this.getTeamMembers();
        return teamMembers.find((member) => member.id === gitHubId);
    }
    async fetchDataFromAPI(url) {
        const response = await this.serviceClient.sendRequest({ url, method: 'GET' });
        // TODO @lramos15 Fix this as throwing is not the best way to handle errors
        if (!response.bodyAsText) {
            throw new Error('No body in response');
        }
        return JSON.parse(response.bodyAsText);
    }
}
exports.VSCodeToolsAPIManager = VSCodeToolsAPIManager;
//# sourceMappingURL=vscodeTools.js.map