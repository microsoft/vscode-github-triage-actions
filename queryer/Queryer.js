"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Queryer {
    constructor(github, query, limit) {
        this.github = github;
        this.query = query;
        this.limit = limit;
    }
    async run() {
        const results = [];
        for await (const pageData of this.github.query({ q: this.query })) {
            for (const issue of pageData) {
                const issueData = await issue.getIssue();
                results.push(issueData);
                if (this.limit && results.length >= this.limit)
                    return results;
            }
        }
        return results;
    }
}
exports.Queryer = Queryer;
//# sourceMappingURL=Queryer.js.map