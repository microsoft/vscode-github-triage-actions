from sklearn.datasets import load_files
from collections import defaultdict
import os
import joblib
import json
import sys


sys.path.insert(0, ".")


BASE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_PATH, "train_data")
MODEL_DIR = os.path.join(BASE_PATH, "..", "blobStorage")


def load_test_data(category):
    return load_files(
        os.path.join(DATA_DIR, category, "test"),
        encoding="utf-8",
        decode_error="replace",
        shuffle=True,
        random_state=42,
    )


def load_classifier(category):
    with open(os.path.join(MODEL_DIR, category + "-model-config.json")) as infile:
        classifier = json.load(infile)
        classifier["text_clf"] = joblib.load(
            os.path.join(MODEL_DIR, category + "-model.pickle")
        )
        return classifier


def divide(num, denom):
    ratio = "" if denom == 0 else str(int((num / denom) * 100)) + "%"
    return f"{ratio} ({num}/{denom})"


for category in ["area", "editor", "workbench", "assignee"]:
    print(category + ": ")

    test_data = load_test_data(category)
    classifier_data = load_classifier(category)
    classifier = classifier_data["text_clf"]
    target_names = classifier_data["target_names"]
    min_prob = classifier_data["min_prob"]

    correct = defaultdict(int)
    items = defaultdict(int)
    guesses = defaultdict(int)

    predictions = classifier.predict_proba(test_data.data)
    for prediction, true_index in zip(predictions, test_data.target):
        true_class = target_names[true_index]
        items[true_class] += 1

        top_class, top_prob = max(
            [(target_names[c], prob) for c, prob in enumerate(prediction)],
            key=lambda p: p[1],
        )

        if top_prob > min_prob and top_class != "__OTHER__":
            guesses[top_class] += 1
            if top_class == true_class:
                correct[top_class] += 1

    for target_name in target_names:
        print(target_name + ": ")
        print("\tRecall", divide(correct[target_name], items[target_name]))
        print("\tAccuracy", divide(correct[target_name], guesses[target_name]))

    print()
    print("Overall: ")
    print("Recall", divide(sum(correct.values()), sum(items.values())))
    print("Accuracy", divide(sum(correct.values()), sum(guesses.values())))
    print()
