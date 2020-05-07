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
editor_classifier = loadClassifier("editor")
workbench_classifier = loadClassifier("workbench")
assignee_classifier = loadClassifier("assignee")


def refine_label(label, issue_data):
    if label == "editor":
        return apply_classifier(editor_classifier, issue_data)
    elif label == "workbench":
        return apply_classifier(workbench_classifier, issue_data)
    else:
        return [label]


def get_top_labels(issue_data):
    labels = []
    for label in apply_classifier(area_classifier, issue_data):
        labels += refine_label(label, issue_data)

    return labels


def get_assignee(issue_data):
    assignees = apply_classifier(assignee_classifier, issue_data)
    if len(assignees) > 0:
        return assignees[0]
    return None


def get_label_config(config):
    if isinstance(config, dict):
        return config
    if isinstance(config, list):
        return {"assignees": config, "assignLabel": True}
    return {"assignees": [], "assignLabel": True}


def apply_classifier(classifier, text):
    return predict(
        classifier["text_clf"],
        classifier["target_names"],
        text,
        classifier["min_prob"],
        classifier["ignore_labels"],
    )


def predict(text_clf, target_names, text, min_prob, ignore_labels):
    print("getting prediction for ", text)
    probs = text_clf.predict_proba([text])[0]
    best = sorted(enumerate(probs), key=lambda p: -p[1])
    print("threshold", min_prob)
    print(
        "estimated",
        [(target_names[i], str(int(round(p, 2) * 100)) + "%") for i, p in best[:5]],
    )

    return [
        target_names[i]
        for i, p in best
        if p > min_prob and target_names[i] not in ignore_labels
    ]


def main():
    results = []
    with open(os.path.join(BASE_PATH, "issue_data.json")) as f:
        issue_data = json.load(f)
        for issue in issue_data:
            results.append(
                {
                    "number": issue["number"],
                    "labels": get_top_labels(issue["contents"]),
                    "assignee": get_assignee(issue["contents"]),
                    "contents": issue["contents"],
                }
            )

    print("Generated labels: ")
    for issue in results:
        print(issue["number"], ": ", "-", issue["labels"], issue["assignee"])

    with open(os.path.join(BASE_PATH, "issue_labels.json"), "w") as f:
        json.dump(results, f)


if __name__ == "__main__":
    main()
