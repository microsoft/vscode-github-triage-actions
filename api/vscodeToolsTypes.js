"use strict";
// A bunch of types for the VS Code API. Mostly lifted straight from
// https://github.com/microsoft/vscode-tools/blob/1b3bc9961a4e4305560fe8d20c7c845884f2b1a4/src/common/src/team.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.RotatingMode = exports.DISCUSSIONS_DUTY = exports.TWITTER_DUTY = exports.BUILD_DUTY = exports.TESTING_DUTY = exports.ENDGAME_DUTY = exports.TRIAGE_DUTY = exports.Availability = exports.Role = exports.Platform = void 0;
var Platform;
(function (Platform) {
    Platform[Platform["MAC"] = 1] = "MAC";
    Platform[Platform["WINDOWS"] = 2] = "WINDOWS";
    Platform[Platform["LINUX"] = 3] = "LINUX";
    Platform[Platform["IPAD"] = 4] = "IPAD";
})(Platform = exports.Platform || (exports.Platform = {}));
var Role;
(function (Role) {
    Role["CONTENT_DEVELOPER"] = "Content Developer";
    Role["DEVELOPER"] = "Developer";
    Role["DESIGNER"] = "Designer";
    Role["ENGINEERING_MANAGER"] = "Engineering Manager";
    Role["PROGRAM_MANAGER"] = "Program Manager";
    Role["OTHER"] = "Other";
})(Role = exports.Role || (exports.Role = {}));
// Note: referened by triage bot to find triagers who are not "NOT_AVAILABLE", please make updates there too :)
// https://github.com/microsoft/vscode-tools/blob/main/src/common/src/team.ts#L21
var Availability;
(function (Availability) {
    Availability[Availability["FULL"] = 1] = "FULL";
    Availability[Availability["HALF"] = 2] = "HALF";
    Availability[Availability["NOT_AVAILABLE"] = 3] = "NOT_AVAILABLE";
})(Availability = exports.Availability || (exports.Availability = {}));
exports.TRIAGE_DUTY = 'triage';
exports.ENDGAME_DUTY = 'endgame';
exports.TESTING_DUTY = 'testing';
exports.BUILD_DUTY = 'build';
exports.TWITTER_DUTY = 'twitter';
exports.DISCUSSIONS_DUTY = 'discussions';
var RotatingMode;
(function (RotatingMode) {
    RotatingMode[RotatingMode["NONE"] = 0] = "NONE";
    RotatingMode["WEEKLY"] = "weekly";
    RotatingMode["MONTHLY"] = "monthly";
})(RotatingMode = exports.RotatingMode || (exports.RotatingMode = {}));
//# sourceMappingURL=vscodeToolsTypes.js.map