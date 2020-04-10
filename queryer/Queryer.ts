import { GitHub } from '../api/api'

export class Queryer {
	constructor(private github: GitHub, private query: string, private limit?: number) {}

	async run() {
		const results = []
		for await (const pageData of this.github.query({ q: this.query })) {
			for (const issue of pageData) {
				const issueData = await issue.getIssue()
				results.push(issueData)
				if (this.limit && results.length >= this.limit) return results
			}
		}
		return results
	}
}
