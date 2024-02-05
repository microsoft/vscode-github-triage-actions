# ---------------------------------------------------------------------------------------------
#  Copyright (c) Microsoft Corporation. All rights reserved.
#  Licensed under the MIT License. See LICENSE in the project root for license information.
# --------------------------------------------------------------------------------------------*/

import joblib
import json
import sys
import os.path

# Allow pickling the snowball stemmer to work right
sys.path.insert(0, ".")

BASE_PATH = os.path.join(os.path.dirname(__file__), "..")
MODEL_PATH = os.path.abspath(os.path.join(BASE_PATH, "..", "blobStorage"))
print("running with BASE_PATH, MODEL_PATH:", BASE_PATH, MODEL_PATH)


def loadClassifier(classification):
    with open(
        os.path.join(MODEL_PATH, classification + "-model-config.json")
    ) as infile:
        classifier = json.load(infile)
        classifier["text_clf"] = joblib.load(
            os.path.join(MODEL_PATH, classification + "-model.pickle")
        )
        return classifier


area_classifier = loadClassifier("area")
assignee_classifier = loadClassifier("assignee")

def get_classification(issue_data, classifier):
    categories = apply_classifier(classifier, issue_data)
    if len(categories) > 0:
        return categories[0]
    return None

def apply_classifier(classifier, text):
    return predict(
        classifier["text_clf"],
        classifier["target_names"],
        text,
        classifier["min_prob"],
        classifier["ignore_labels"],
    )


def predict(text_clf, target_names, text, min_prob, ignore_labels):
    probs = text_clf.predict_proba([text])[0]
    best = sorted(enumerate(probs), key=lambda p: -p[1])


    return [
        target_names[i]
        for i, p in best
        if p > min_prob and target_names[i] not in ignore_labels
    ]


def main(debug=False):
    results = []
    with open(os.path.join(BASE_PATH, "issue_data.json")) as f:
        issue_data = json.load(f)
        for issue in issue_data:
            result = {
                "number": issue["number"],
                "area": get_classification(issue["contents"], loadClassifier("area")),
                "assignee": get_classification(issue["contents"], loadClassifier("assignee")),
                "contents": issue["contents"],
            }
            results.append(result)
            if (debug):
                # Print issue number, area, and assignee from the results
                print("Issue number: ", result["number"], "Area: ", result["area"], "Assignee: ", result["assignee"])

    with open(os.path.join(BASE_PATH, "issue_labels.json"), "w") as f:
        json.dump(results, f)


if __name__ == "__main__":
    debug = '--debug' in sys.argv
    main(debug=debug)
