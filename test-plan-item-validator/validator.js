"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.rtrimSpaceAndEOL = exports.parseHeaderRange = exports.parseTestPlanItem = exports.TesterRole = exports.Platform = void 0;
/* eslint-disable */
var Platform;
(function (Platform) {
    Platform[Platform["MAC"] = 1] = "MAC";
    Platform[Platform["WINDOWS"] = 2] = "WINDOWS";
    Platform[Platform["LINUX"] = 3] = "LINUX";
    Platform[Platform["IPAD"] = 4] = "IPAD";
})(Platform = exports.Platform || (exports.Platform = {}));
var TesterRole;
(function (TesterRole) {
    TesterRole["CONTENT_DEVELOPER"] = "Content Developer";
    TesterRole["DEVELOPER"] = "Developer";
    TesterRole["DESIGNER"] = "Designer";
    TesterRole["ENGINEERING_MANAGER"] = "Engineering Manager";
    TesterRole["PROGRAM_MANAGER"] = "Program Manager";
    TesterRole["OTHER"] = "Other";
})(TesterRole = exports.TesterRole || (exports.TesterRole = {}));
// Make sure all platform assignments have similar groups
const MacPlatformTerm = `(mac(os)?)`;
const MacPlatformAssignment = new RegExp(`\\[([\\sx])\\]\\s+${MacPlatformTerm}\\s*:?\\s*`, 'i');
const IPadPlatformTerm = `(ipad(os)?|(ios))`;
const IPadPlatformAssignment = new RegExp(`\\[([\\sx])\\]\\s+${IPadPlatformTerm}\\s*:?\\s*`, 'i');
const WindowsPlatformTerm = `(win(dows)?|(wsl))`;
const WindowsPlatformAssignment = new RegExp(`\\[([\\sx])\\]\\s+${WindowsPlatformTerm}\\s*:?\\s*`, 'i');
const LinuxPlatformTerm = `(linux)`;
const LinuxPlatformAssignment = new RegExp(`\\[([\\sx])\\]\\s+${LinuxPlatformTerm}\\s*:?\\s*`, 'i');
const AnyPlatformTerm = `(any\\s*(os)?|ssh|dev\\s?container|web)`;
const AnyPlatformAssignment = new RegExp(`\\[([\\sx])\\]\\s+${AnyPlatformTerm}\\s*:?\\s*`, 'i');
const InvalidAssignment = new RegExp(`\\[[\\sx]\\]\\s+(?!(${MacPlatformTerm}|${WindowsPlatformTerm}|${LinuxPlatformTerm}|${IPadPlatformTerm}|${AnyPlatformTerm}))\\s*:?\\s*`, 'i');
function parseTestPlanItem(body, author) {
    const headerRange = parseHeaderRange(body);
    const testPlanItem = { complexity: 3, assignments: [], issueRefs: [], roles: undefined, authors: [], headerRange };
    const header = body.substring(testPlanItem.headerRange[0], testPlanItem.headerRange[1]);
    testPlanItem.issueRefs = parseRefs(header);
    testPlanItem.complexity = parseComplexity(header);
    testPlanItem.roles = parseRoles(header);
    testPlanItem.authors = distinct([author, ...parseAuthors(header)]);
    testPlanItem.assignments = [];
    parsePlatformAssignment(header, Platform.MAC, MacPlatformAssignment, testPlanItem.assignments);
    parsePlatformAssignment(header, Platform.WINDOWS, WindowsPlatformAssignment, testPlanItem.assignments);
    parsePlatformAssignment(header, Platform.LINUX, LinuxPlatformAssignment, testPlanItem.assignments);
    parsePlatformAssignment(header, Platform.IPAD, IPadPlatformAssignment, testPlanItem.assignments);
    parseAnyPlatformAssignments(header, testPlanItem.assignments);
    if (testPlanItem.complexity < 1 || testPlanItem.complexity > 5) {
        throw new Error('Test plan item complexity should be between 1 to 5');
    }
    if (testPlanItem.assignments.length === 0) {
        throw new Error('Test plan item should have assignments');
    }
    let matches = InvalidAssignment.exec(header);
    if (matches && matches.length) {
        throw new Error(`Test plan item has invalid assignments - ${header.substring(matches.index).split('\n')[0]}`);
    }
    return testPlanItem;
}
exports.parseTestPlanItem = parseTestPlanItem;
function parseHeaderRange(body) {
    const matches = /(\r\n|\n)----*\s*(\r\n|\n)/i.exec(body);
    if (matches && matches.length) {
        return [0, matches.index];
    }
    throw new Error('Test plan item should have header');
}
exports.parseHeaderRange = parseHeaderRange;
function parseRefs(body) {
    const refsRegex = /(ref(s)?)\s*[:-]?\s*(.*)/i;
    const refsMatches = refsRegex.exec(body);
    if (!refsMatches || !refsMatches[3]) {
        return [];
    }
    const referencedIssues = refsMatches[3].split(',');
    const issues = [];
    for (let ref of referencedIssues) {
        ref = ref.trim();
        // Issues can be of two types #123 or https://www.github.com/owner/repo/issues/number
        if (ref.startsWith('#')) {
            issues.push(parseInt(ref.substring(1)));
        }
        else {
            // Check if the issue is a valid github issue by checking if it has a valid url 
            const issueUrlRegex = /https:\/\/github.com\/.*\/.*\/issues\/(\d+)/i;
            const issueUrlMatches = issueUrlRegex.exec(ref);
            // Extract the url and push it back to the issues array
            if (issueUrlMatches && issueUrlMatches.length) {
                issues.push(issueUrlMatches[0]);
            }
        }
    }
    return issues;
}
function parseComplexity(body) {
    const complexityMatches = /\**(complexity|size)\s*[:-]?\s*\**\s*(\d)/i.exec(body);
    return complexityMatches && complexityMatches[2] ? parseInt(complexityMatches[2]) : 3;
}
function parseRoles(body) {
    const roleMatches = /role(s)?\s*[:-]?\s*(<\!--.*-->)*(.*)/i.exec(body);
    if (roleMatches && roleMatches[3]) {
        const result = [];
        const roles = roleMatches[3].toLowerCase().trim().split(',');
        for (let role of roles) {
            role = role.trim();
            if (role === TesterRole.CONTENT_DEVELOPER.toLowerCase()) {
                if (!result.includes(TesterRole.CONTENT_DEVELOPER)) {
                    result.push(TesterRole.CONTENT_DEVELOPER);
                }
                continue;
            }
            if (role === TesterRole.DESIGNER.toLowerCase()) {
                if (!result.includes(TesterRole.DESIGNER)) {
                    result.push(TesterRole.DESIGNER);
                }
                continue;
            }
            if (role === TesterRole.DEVELOPER.toLowerCase()) {
                if (!result.includes(TesterRole.DEVELOPER)) {
                    result.push(TesterRole.DEVELOPER);
                }
                continue;
            }
            if (role === TesterRole.ENGINEERING_MANAGER.toLowerCase()) {
                if (!result.includes(TesterRole.ENGINEERING_MANAGER)) {
                    result.push(TesterRole.ENGINEERING_MANAGER);
                }
                continue;
            }
            if (role === TesterRole.PROGRAM_MANAGER.toLowerCase()) {
                if (!result.includes(TesterRole.PROGRAM_MANAGER)) {
                    result.push(TesterRole.PROGRAM_MANAGER);
                }
                continue;
            }
        }
        return result.length ? result : undefined;
    }
    return undefined;
}
function parseAuthors(body) {
    const matches = /author(s)?\s*[:-]?\s*(<\!--.*-->)*(.*)/i.exec(body);
    if (!matches || !matches[3]) {
        return [];
    }
    const authors = [];
    for (const value of matches[3].trim().split(',')) {
        for (const author of value.trim().split(' ')) {
            authors.push(author.startsWith('@') ? author.substring(1) : author);
        }
    }
    return authors;
}
function parsePlatformAssignment(body, platform, regex, platformAssignments) {
    let matches = regex.exec(body);
    let startIndex = 0;
    let endIndex = 0;
    while (matches && matches.length) {
        const platformAssignment = { platform, checked: false, range: [-1, -1], user: undefined, userRange: [-1, -1] };
        platformAssignments.push(platformAssignment);
        startIndex = endIndex + matches.index;
        setUserAssignment(body, { match: matches[0], start: startIndex }, platformAssignment);
        endIndex = findEOLIndex(body, matches[0], startIndex);
        platformAssignment.range = [findStartIndex(body, matches[0], startIndex), endIndex];
        platformAssignment.checked = matches[1] === 'x' && !!platformAssignment.user;
        matches = regex.exec(body.substring(endIndex));
    }
}
function parseAnyPlatformAssignments(body, platformAssignments) {
    const anyPlatforms = [Platform.MAC, Platform.WINDOWS, Platform.LINUX];
    let startIndex = 0;
    while (startIndex !== -1) {
        startIndex = parseAnyPlatformAssignmentsStartingFrom(body, startIndex, anyPlatforms, platformAssignments);
    }
}
function parseAnyPlatformAssignmentsStartingFrom(body, fromIndex, anyPlatforms, platformAssignments) {
    const matches = AnyPlatformAssignment.exec(body.substring(fromIndex));
    if (matches && matches.length) {
        let platformAssignmentsCount;
        for (const platform of anyPlatforms) {
            const count = platformAssignments.filter(a => a.platform === platform).length;
            if (!platformAssignmentsCount || count < platformAssignmentsCount[1]) {
                platformAssignmentsCount = [platform, count];
            }
        }
        const platformAssignment = { platform: platformAssignmentsCount ? platformAssignmentsCount[0] : anyPlatforms[0], checked: false, user: undefined, userRange: [-1, -1], range: [-1, -1] };
        platformAssignments.push(platformAssignment);
        const startIndex = fromIndex + matches.index;
        setUserAssignment(body, { match: matches[0], start: startIndex }, platformAssignment);
        const endIndex = findEOLIndex(body, matches[0], startIndex);
        platformAssignment.range = [findStartIndex(body, matches[0], startIndex), endIndex];
        platformAssignment.checked = matches[1] === 'x' && !!platformAssignment.user;
        return endIndex;
    }
    return -1;
}
function setUserAssignment(body, { match, start }, platformAssignment) {
    let from = start + match.length;
    const matches = /^@([^\s\*\r\n]+)\s*/i.exec(body.substring(from));
    if (matches && matches.length) {
        platformAssignment.user = matches[1] ? matches[1].trim() : void 0;
        platformAssignment.userRange = [from + matches.index, from + matches.index + matches[0].length];
    }
    else {
        const trimmedText = rtrimSpaceAndEOL(match);
        const index = start + trimmedText.length;
        platformAssignment.userRange = [index, index];
    }
}
function findStartIndex(body, match, matchStartIndex) {
    const trimmedText = rtrimSpaceAndEOL(match);
    const eolIndex = body.substring(0, matchStartIndex + trimmedText.length).lastIndexOf('\n');
    return eolIndex !== -1 ? eolIndex + 1 : 0;
}
function findEOLIndex(body, match, matchStartIndex) {
    const trimmedText = rtrimSpaceAndEOL(match);
    const eolIndex = body.indexOf('\n', matchStartIndex + trimmedText.length);
    if (eolIndex === -1) {
        return body.length;
    }
    if (body[eolIndex - 1] === '\r') {
        return eolIndex - 1;
    }
    return eolIndex;
}
function rtrimSpaceAndEOL(haystack) {
    if (!haystack) {
        return haystack;
    }
    const endsWith = (needle, offset) => {
        idx = haystack.lastIndexOf(needle, offset - needle.length);
        return idx !== -1 && idx + needle.length === offset;
    };
    let offset = haystack.length, idx = -1;
    while (offset !== 0) {
        if (endsWith(' ', offset)
            || endsWith('\t', offset)) {
            offset = offset - 1;
        }
        else if (endsWith('\n', offset)) {
            offset = offset - 1;
            if (endsWith('\r', offset)) {
                offset = offset - 1;
            }
        }
        else {
            break;
        }
    }
    return haystack.substring(0, offset);
}
exports.rtrimSpaceAndEOL = rtrimSpaceAndEOL;
function distinct(array, keyFn) {
    if (!keyFn) {
        return array.filter((element, position) => {
            return array.indexOf(element) === position;
        });
    }
    const seen = Object.create(null);
    return array.filter((elem) => {
        const key = keyFn(elem);
        if (seen[key]) {
            return false;
        }
        seen[key] = true;
        return true;
    });
}
//# sourceMappingURL=validator.js.map