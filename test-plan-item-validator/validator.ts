/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint-disable */

enum Platform {
	MAC = 1,
	WINDOWS,
	LINUX
}

function distinct<T>(array: T[], keyFn?: (t: T) => string): T[] {
	if (!keyFn) {
		return array.filter((element, position) => {
			return array.indexOf(element) === position
		})
	}

	const seen: { [key: string]: boolean; } = Object.create(null)
	return array.filter((elem) => {
		const key = keyFn(elem)
		if (seen[key]) {
			return false
		}

		seen[key] = true

		return true
	})
}

interface PlatformAssigment {
	platform: Platform;
	user: string;
	range: [number, number];
}

interface TestPlanItem {
	complexity: number;
	assignments: PlatformAssigment[];
	authors: string[];
}

// Make sure all platform assignments have similar groups
const MacPlatformTerm = '(mac(os)?)'
const MacPlatformAssignment: RegExp = new RegExp(`\\[[\\sx]\\]\\s+${MacPlatformTerm}\\s*:?\\s*`, 'i')
const WindowsPlatformTerm = '(win(dows)?|(wsl))'
const WindowsPlatformAssignment: RegExp = new RegExp(`\\[[\\sx]\\]\\s+${WindowsPlatformTerm}\\s*:?\\s*`, 'i')
const LinuxPlatformTerm = '(linux)'
const LinuxPlatformAssignment: RegExp = new RegExp(`\\[[\\sx]\\]\\s+${LinuxPlatformTerm}\\s*:?\\s*`, 'i')
const AnyPlatformTerm = '(any\\s*(os)?|ssh|dev\\s?container)'
const AnyPlatformAssignment: RegExp = new RegExp(`\\[[\\sx]\\]\\s+${AnyPlatformTerm}\\s*:?\\s*`, 'i')
const InvalidAssignment: RegExp = new RegExp(`\\[[\\sx]\\]\\s+(?!(${MacPlatformTerm}|${WindowsPlatformTerm}|${LinuxPlatformTerm}|${AnyPlatformTerm}))\\s*:?\\s*`, 'i')

export function parseTestPlanItem(body: string, author: string): TestPlanItem {
	const testPlanItem: TestPlanItem = { complexity: 3, assignments: [], authors: [] }
	const header = parseHeader(body)
	testPlanItem.complexity = parseComplexity(header)
	testPlanItem.authors = distinct([author, ...parseAuthors(header)])

	testPlanItem.assignments = []
	parsePlatformAssignment(header, Platform.MAC, testPlanItem.assignments)
	parsePlatformAssignment(header, Platform.WINDOWS, testPlanItem.assignments)
	parsePlatformAssignment(header, Platform.LINUX, testPlanItem.assignments)
	parseAnyPlatformAssignments(header, testPlanItem.assignments)

	if (testPlanItem.complexity < 1 || testPlanItem.complexity > 5) {
		throw new Error('Test plan item complexity should be between 1 to 5')
	}

	if (testPlanItem.assignments.length === 0) {
		throw new Error('Test plan item should have assignments')
	}

	let matches = InvalidAssignment.exec(body)
	if (matches && matches.length) {
		throw new Error(`Test plan item has invalid assignments - ${body.substring(matches.index).split('\n')[0]}`)
	}

	return testPlanItem
}

function parseHeader(body: string): string {
	const matches = /(\r\n|\n)----*(\r\n|\n)/i.exec(body)
	if (matches && matches.length) {
		return body.substring(0, matches.index)
	}
	throw new Error('Test plan item should have header')
}

function parseComplexity(body: string): number {
	const complexityMatches = /\**(complexity|size)\s*[:-]?\s*\**\s*(\d)/i.exec(body)
	return complexityMatches && complexityMatches[2] ? parseInt(complexityMatches[2]) : 3
}

function parseAuthors(body: string): string[] {
	const matches = /author(s)?\s*[:-]?\s*(<\!--.*-->)*(.*)/i.exec(body)
	return matches && matches[3] ? matches[3].trim().split(',').map(a => {
		a = a.trim()
		return a.indexOf('@') === 0 ? a.substring(1) : a
	}) : []
}

function parsePlatformAssignment(body: string, platform: Platform, platformAssignments: PlatformAssigment[]): void {
	let regex: RegExp
	switch (platform) {
		case Platform.MAC: regex = MacPlatformAssignment; break
		case Platform.WINDOWS: regex = WindowsPlatformAssignment; break
		case Platform.LINUX: regex = LinuxPlatformAssignment; break
	}
	let matches = regex.exec(body)
	if (matches && matches.length) {
		const platformAssignment: PlatformAssigment = { platform, user: undefined!, range: undefined! }
		platformAssignments.push(platformAssignment)
		let endIndex = setUserAssignment(body, { match: matches[0], start: matches.index }, platformAssignment)
		matches = regex.exec(body.substring(endIndex))
		if (matches && matches.length) {
			const platformAssignment: PlatformAssigment = { platform, user: undefined!, range: undefined! }
			platformAssignments.push(platformAssignment)
			endIndex = setUserAssignment(body, { match: matches[0], start: endIndex + matches.index }, platformAssignment)
			matches = regex.exec(body.substring(endIndex))
			if (matches && matches.length) {
				const platformAssignment: PlatformAssigment = { platform, user: undefined!, range: undefined! }
				platformAssignments.push(platformAssignment)
				endIndex = setUserAssignment(body, { match: matches[0], start: endIndex + matches.index }, platformAssignment)
			}
		}
	}
}

function parseAnyPlatformAssignments(body: string, platformAssignments: PlatformAssigment[]): void {
	const allPlatforms = [Platform.MAC, Platform.WINDOWS, Platform.LINUX]
	let fromIndex = 0
	fromIndex = parseAnyPlatformAssignmentsStartingFrom(body, fromIndex, allPlatforms, platformAssignments)
	if (fromIndex !== -1) {
		fromIndex = parseAnyPlatformAssignmentsStartingFrom(body, fromIndex, allPlatforms, platformAssignments)
		if (fromIndex !== -1) {
			parseAnyPlatformAssignmentsStartingFrom(body, fromIndex, allPlatforms, platformAssignments)
		}
	}
}

function parseAnyPlatformAssignmentsStartingFrom(body: string, fromIndex: number, platforms: Platform[], platformAssignments: PlatformAssigment[]): number {
	const matches = AnyPlatformAssignment.exec(body.substring(fromIndex))
	if (matches && matches.length) {
		for (const platform of platforms) {
			if (!platformAssignments.some(assignment => assignment.platform === platform)) {
				const platformAssignment: PlatformAssigment = { platform, user: (void 0)!, range: (void 0)! }
				platformAssignments.push(platformAssignment)
				let endIndex = setUserAssignment(body, { match: matches[0], start: fromIndex + matches.index }, platformAssignment)
				return endIndex
			}
		}
	}
	return -1
}

function setUserAssignment(body: string, { match, start }: { match: string, start: number }, platformAssignment: PlatformAssigment): number {
	let from = start + match.length
	const matches = /^@([^\s\*\r\n]+)\s*/i.exec(body.substring(from))
	if (matches && matches.length) {
		platformAssignment.user = matches[1] ? matches[1].trim() : (void 0)!
		platformAssignment.range = [from + matches.index, from + matches.index + matches[0].length]
		return platformAssignment.range[1]
	} else {
		let trimmedText = match
		trimmedText = rtrimSpaceAndEOL(trimmedText)
		let index = start + trimmedText.length
		platformAssignment.range = [index, index]
		return from
	}
}

function rtrimSpaceAndEOL(haystack: string): string {
	if (!haystack) {
		return haystack
	}

	const endsWith = (needle: string, offset: number): boolean => {
		idx = haystack.lastIndexOf(needle, offset - needle.length)
		return idx !== - 1 && idx + needle.length === offset
	}

	let offset = haystack.length,
		idx = -1

	while (offset !== 0) {
		if (endsWith(' ', offset)
			|| endsWith('\t', offset)) {
			offset = offset - 1
		} else if (endsWith('\n', offset)) {
			offset = offset - 1
			if (endsWith('\r', offset)) {
				offset = offset - 1
			}
		} else {
			break
		}
	}

	return haystack.substring(0, offset)
}