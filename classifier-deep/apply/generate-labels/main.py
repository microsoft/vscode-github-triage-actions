# ---------------------------------------------------------------------------------------------
#  Copyright (c) Microsoft Corporation. All rights reserved.
#  Licensed under the MIT License. See LICENSE in the project root for license information.
# --------------------------------------------------------------------------------------------*/

from simpletransformers.classification import ClassificationModel
import json
import os.path

BASE_PATH = os.path.join(os.path.dirname(__file__), "..")
print("running with BASE_PATH:", BASE_PATH)

def make_classifier(category, config):
    with open(os.path.join(BASE_PATH, category+'_model', 'target_names.json')) as fp:
        target_names = json.load(fp)

    with open(os.path.join(BASE_PATH, category+'_model', 'thresholds.json')) as fp:
        thresholds = json.load(fp)

    model = ClassificationModel(
        'bert',
        os.path.join(BASE_PATH, category+'_model'),
        num_labels=len(target_names),
        use_cuda=False
    )


    def classify(issue):
        predictions, raw_outputs = model.predict([issue])
        prediction = predictions[0]
        raw_output = raw_outputs[0]

        target_accuracy = str(0.8 if prediction not in config or 'targetAccuracy' not in config[prediction] else config[prediction]['targetAccuracy'])

        available_accuracies = thresholds[target_names[prediction]].keys()
        if len(available_accuracies) == 0: return None

        print({"available_accuracies": available_accuracies})
        target_accuracy = [accuracy for accuracy in available_accuracies if float(accuracy) > float(target_accuracy)][0]

        if raw_output[prediction] < thresholds[target_names[prediction]][target_accuracy]['cutoff']:
            print('Below threshold:', target_names[prediction], raw_output[prediction], issue)
            return None

        print('Above threshold:', target_names[prediction], raw_output[prediction], issue)
        return target_names[prediction]

    return classify


def main():
    results = []

    with open(os.path.join(BASE_PATH, "configuration.json")) as f:
        configuration = json.load(f)

    area_classifier = make_classifier('area', configuration['assignees'])
    assignee_classifier = make_classifier('assignee', configuration['labels'])

    with open(os.path.join(BASE_PATH, "issue_data.json")) as f:
        issue_data = json.load(f)
        for issue in issue_data:
            results.append(
                {
                    "number": issue["number"],
                    "area": area_classifier(issue["contents"]),
                    "assignee": assignee_classifier(issue["contents"]),
                    "contents": issue["contents"],
                }
            )

    print("Generated labels: ")
    for issue in results:
        print(issue["number"], ": ", "-", issue["area"], issue["assignee"])

    with open(os.path.join(BASE_PATH, "issue_labels.json"), "w") as f:
        json.dump(results, f)


if __name__ == "__main__":
    main()
