"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Action_1 = require("../common/Action");
const utils_1 = require("../common/utils");
const EnglishPlease_1 = require("./EnglishPlease");
const nonEnglishLabel = (0, utils_1.getRequiredInput)('nonEnglishLabel');
const needsMoreInfoLabel = (0, utils_1.getRequiredInput)('needsMoreInfoLabel');
const translatorRequestedLabelPrefix = (0, utils_1.getRequiredInput)('translatorRequestedLabelPrefix');
const translatorRequestedLabelColor = (0, utils_1.getRequiredInput)('translatorRequestedLabelColor');
const cognitiveServicesAPIKey = (0, utils_1.getRequiredInput)('cognitiveServicesAPIKey');
class EnglishPlease extends Action_1.Action {
    constructor() {
        super(...arguments);
        this.id = 'EnglishPlease';
    }
    async onOpened(issue) {
        await new EnglishPlease_1.EnglishPleaseLabler(issue, nonEnglishLabel).run();
    }
    async doLanguageSpecific(issue) {
        await new EnglishPlease_1.LanguageSpecificLabeler(issue, translatorRequestedLabelPrefix, translatorRequestedLabelColor, nonEnglishLabel, needsMoreInfoLabel, cognitiveServicesAPIKey).run();
    }
    async onEdited(issue) {
        await this.doLanguageSpecific(issue);
    }
    async onLabeled(issue, label) {
        if (label == nonEnglishLabel)
            await this.doLanguageSpecific(issue);
    }
}
new EnglishPlease().run(); // eslint-disable-line
//# sourceMappingURL=index.js.map