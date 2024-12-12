"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanguageSpecificLabeler = exports.EnglishPleaseLabler = void 0;
const axios_1 = require("axios");
const utils_1 = require("../common/utils");
const translation_data_json_1 = require("./translation-data.json");
const commonNames = translation_data_json_1.commonNames;
const knownTranslations = translation_data_json_1.knownTranslations;
const usKeyboardChars = /\w|\s|\d|[[\]{}`~!@#$%^&*()_+=<>,.?/\\:;'"|-]/gu;
const emojiChars = /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu;
class EnglishPleaseLabler {
    constructor(issue, englishPleaseLabel) {
        this.issue = issue;
        this.englishPleaseLabel = englishPleaseLabel;
    }
    async run() {
        const issue = await this.issue.getIssue();
        const { body, title } = (0, utils_1.normalizeIssue)(issue);
        const translationChunk = `${title} ${body}`;
        const nonenglishChunk = translationChunk.replace(usKeyboardChars, '').replace(emojiChars, '');
        if (nonenglishChunk.length / translationChunk.length > 0.05) {
            await this.issue.addLabel(this.englishPleaseLabel);
            return true;
        }
        return false;
    }
}
exports.EnglishPleaseLabler = EnglishPleaseLabler;
class LanguageSpecificLabeler {
    constructor(issue, translatorRequestedLabelPrefix, translatorRequestedLabelColor, englishPleaseLabel, needsMoreInfoLabel, cognitiveServicesAPIKey) {
        this.issue = issue;
        this.translatorRequestedLabelPrefix = translatorRequestedLabelPrefix;
        this.translatorRequestedLabelColor = translatorRequestedLabelColor;
        this.englishPleaseLabel = englishPleaseLabel;
        this.needsMoreInfoLabel = needsMoreInfoLabel;
        this.cognitiveServicesAPIKey = cognitiveServicesAPIKey;
    }
    async detectLanguage(chunk) {
        var _a, _b;
        const hashedKey = this.cognitiveServicesAPIKey.replace(/./g, '*');
        (0, utils_1.safeLog)('attempting to detect language...', chunk.slice(0, 30), hashedKey);
        const result = await axios_1.default
            .post('https://api.cognitive.microsofttranslator.com/detect?api-version=3.0', [{ text: chunk.slice(0, 200) }], {
            headers: {
                'Ocp-Apim-Subscription-Key': this.cognitiveServicesAPIKey,
                'Content-type': 'application/json',
            },
        })
            .catch((error) => {
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                (0, utils_1.safeLog)('DATA: ' + JSON.stringify(error.response.data));
            }
            else if (error.request) {
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                // http.ClientRequest in node.js
                (0, utils_1.safeLog)('REQUEST: ' + JSON.stringify(error.request));
            }
            else {
                // Something happened in setting up the request that triggered an Error
                (0, utils_1.safeLog)('Error', error.message);
            }
            (0, utils_1.safeLog)('CONFIG: ' + JSON.stringify(error.config));
        });
        return (_b = (_a = result === null || result === void 0 ? void 0 : result.data) === null || _a === void 0 ? void 0 : _a[0].language) !== null && _b !== void 0 ? _b : undefined;
    }
    async translate(text, to) {
        var _a, _b, _c;
        const hashedKey = this.cognitiveServicesAPIKey.replace(/./g, '*');
        (0, utils_1.safeLog)('attempting to translate...', hashedKey, text.slice(0, 20), to);
        const result = await axios_1.default
            .post('https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=' + to, [{ text }], {
            headers: {
                'Ocp-Apim-Subscription-Key': this.cognitiveServicesAPIKey,
                'Content-type': 'application/json',
            },
        })
            .catch((e) => {
            (0, utils_1.safeLog)('error translating language', e);
            throw e;
        });
        return (_c = (_b = (_a = result === null || result === void 0 ? void 0 : result.data) === null || _a === void 0 ? void 0 : _a[0].translations) === null || _b === void 0 ? void 0 : _b[0].text) !== null && _c !== void 0 ? _c : undefined;
    }
    async run() {
        var _a, _b, _c;
        const issue = await this.issue.getIssue();
        const { body, title } = (0, utils_1.normalizeIssue)(issue);
        const translationChunk = `${title} ${body}`;
        for await (const page of this.issue.getComments()) {
            for (const comment of page) {
                if (comment.body.includes('<!-- translation_requested_comment -->')) {
                    return;
                }
            }
        }
        const language = (_a = (await this.detectLanguage(translationChunk))) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        (0, utils_1.safeLog)('Detected language:', language !== null && language !== void 0 ? language : 'undefined');
        if (!language || language === 'en') {
            const languagelabel = issue.labels.find((label) => label.startsWith(this.translatorRequestedLabelPrefix));
            if (languagelabel)
                await this.issue.removeLabel(languagelabel);
            await this.issue.removeLabel(this.englishPleaseLabel);
            await this.issue.removeLabel(this.needsMoreInfoLabel);
        }
        else if (language) {
            const label = this.translatorRequestedLabelPrefix + commonNames[language];
            if (!(await this.issue.repoHasLabel(label))) {
                (0, utils_1.safeLog)('Globally creating label ' + label);
                await this.issue.createLabel(label, this.translatorRequestedLabelColor, '');
            }
            await this.issue.addLabel(label);
            if (this.needsMoreInfoLabel)
                await this.issue.addLabel(this.needsMoreInfoLabel);
            const targetLanguageComment = (_c = (_b = knownTranslations[language]) !== null && _b !== void 0 ? _b : (await this.translate(translation_data_json_1.baseString, language))) !== null && _c !== void 0 ? _c : 'ERR_TRANSLATION_FAILED';
            const englishComment = knownTranslations['en'];
            // check again, another bot may have commented in the mean time.
            for await (const page of this.issue.getComments()) {
                for (const comment of page) {
                    if (comment.body.includes('<!-- translation_requested_comment -->')) {
                        return;
                    }
                }
            }
            await this.issue.postComment(`${targetLanguageComment}\n\n---\n${englishComment}\n<!-- translation_requested_comment -->`);
        }
    }
}
exports.LanguageSpecificLabeler = LanguageSpecificLabeler;
//# sourceMappingURL=EnglishPlease.js.map