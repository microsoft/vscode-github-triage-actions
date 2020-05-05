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

base_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
print("running with base_path:", base_path)


def loadClassifier(classification):
    with open(
        os.path.join(base_path, "..", classification + "-model-config.json")
    ) as infile:
        classifier = json.load(infile)
        classifier["text_clf"] = joblib.load(
            os.path.join(base_path, "..", classification + "-model.pickle")
        )
        return classifier


area_classifier = loadClassifier("area")
editor_classifier = loadClassifier("editor")
workbench_classifier = loadClassifier("workbench")


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


def get_label_config(config):
    if isinstance(config, dict):
        return config
    if isinstance(config, list):
        return {"assignees": config, "assignLabel": True}
    return {"assignees": [], "assignLabel": True}


def apply_classifier(classifier, text):
    return predict(
        classifier["text_clf"], classifier["target_names"], text, classifier["min_prob"]
    )


def predict(text_clf, target_names, text, min_prob):
    print("getting prediction for ", text)
    probs = text_clf.predict_proba([text])[0]
    best = sorted(enumerate(probs), key=lambda p: -p[1])
    print("threshold", min_prob)
    print(
        "estimated",
        [(target_names[i], str(int(round(p, 2) * 100)) + "%") for i, p in best[:5]],
    )

    return [target_names[i] for i, p in best if p > min_prob]


def main():
    results = []
    with open(os.path.join(base_path, "issue_data.json")) as f:
        issue_data = json.load(f)
        for issue in issue_data:
            results.append(
                {
                    "number": issue["number"],
                    "labels": get_top_labels(issue["contents"]),
                }
            )

    print("Generated labels: ")
    for issue in results:
        print(
            issue["number"], ": ", json.dumps(issue["contents"]), "-", issue["labels"]
        )
    with open(os.path.join(base_path, "issue_labels.json"), "w") as f:
        json.dump(results, f)


if __name__ == "__main__":
    main()
