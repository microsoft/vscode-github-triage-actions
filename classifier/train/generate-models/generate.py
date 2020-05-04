# ---------------------------------------------------------------------------------------------
#  Copyright (c) Microsoft Corporation. All rights reserved.
#  Licensed under the MIT License. See LICENSE in the project root for license information.
# --------------------------------------------------------------------------------------------*/

from sklearn.feature_extraction.text import CountVectorizer
from sklearn.feature_extraction.text import TfidfTransformer
from sklearn.linear_model import SGDClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.ensemble import AdaBoostClassifier
from sklearn.pipeline import Pipeline
from sklearn.datasets import load_files
from sklearn import metrics
import numpy as np
import joblib
import json
from multiprocessing import Pool, cpu_count
import multiprocessing as mp
import sys
import os

sys.path.insert(0, ".")
from utils import StemmedCountVectorizer  # noqa

CUTOFF_EXPLORATION_RATE = 10
PROB_EXPLORATION_RATE = 3

SKIP_WEIGHT = 0
CORRECT_WEIGHT = [1]
INCORRECT_WEIGHT = -2

MAX_OPTIONS = 1

FILTER_DATA = False

DATA_DIR = sys.argv[-1]

BASE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


if not (DATA_DIR == "assignee" or DATA_DIR == "category"):
    raise Exception("Invalid data dir", DATA_DIR)


def new_text_clf():
    return Pipeline(
        [
            ("vect", StemmedCountVectorizer(ngram_range=(1, 1), max_df=0.9, min_df=3),),
            ("tfidf", TfidfTransformer(use_idf=True)),
            (
                "clf",
                # sample.py picks best algorithm
                SGDClassifier(
                    loss="modified_huber", penalty="l2", alpha=0.001, random_state=42
                ),
            ),
        ]
    )


def load_test(category):
    return load_files(
        os.path.join(BASE_PATH, DATA_DIR, category, "test"),
        encoding="utf-8",
        decode_error="replace",
        shuffle=True,
        random_state=42,
    )


def load_train(category):
    return load_files(
        os.path.join(BASE_PATH, DATA_DIR, category, "train"),
        encoding="utf-8",
        decode_error="replace",
        shuffle=True,
        random_state=42,
    )


def filter_data(data, scores, cutoff):
    for i, f in reversed(list(enumerate(scores))):
        if f < cutoff:
            del data.target_names[i]
            for j, t in reversed(list(enumerate(data.target))):
                if t == i:
                    del data.data[j]
                    data.target = np.delete(data.target, (j), axis=0)
                elif t > i:
                    data.target[j] -= 1


def print_metrics(
    method, cutoff, train, test, predicted, ignore_labels, min_prob, res,
):
    some_correct = sum(
        calc_score(predicted, target, train, test, ignore_labels, 0, [1, 1, 1], 0,)
        for predicted, target in zip(predicted, test.target)
    )

    first_correct = sum(
        calc_score(predicted, target, train, test, ignore_labels, 0, [1, 0, 0], 0,)
        for predicted, target in zip(predicted, test.target)
    )

    second_correct = sum(
        calc_score(predicted, target, train, test, ignore_labels, 0, [0, 1, 0], 0,)
        for predicted, target in zip(predicted, test.target)
    )

    third_correct = sum(
        calc_score(predicted, target, train, test, ignore_labels, 0, [0, 0, 1], 0,)
        for predicted, target in zip(predicted, test.target)
    )

    unknown = sum(
        calc_score(predicted, target, train, test, ignore_labels, 1, [0, 0, 0], 0,)
        for predicted, target in zip(predicted, test.target)
    )

    incorrect = sum(
        calc_score(predicted, target, train, test, ignore_labels, 0, [0, 0, 0], 1,)
        for predicted, target in zip(predicted, test.target)
    )

    print("Cutoff method", method)
    print("Cutoff threshold", cutoff)
    print("Probability threshold: {0}".format(min_prob))
    print("Weighted result: {0}".format(res))
    print("Ignored labels: {0}".format(ignore_labels))
    print(
        "Corect {0} undecided {1} incorrect {2}".format(
            some_correct, unknown, incorrect
        )
    )
    print(
        "Correct first {0} second {1} third {2}".format(
            first_correct, second_correct, third_correct
        )
    )


def calc_score(
    predicted,
    target,
    train,
    test,
    ignore_labels,
    skip_weight,
    correct_weight,
    incorrect_weight,
):
    if predicted is None:
        return skip_weight

    for index, prediction in enumerate(predicted):
        if index >= MAX_OPTIONS:
            break

        if train.target_names[prediction] in ignore_labels:
            return skip_weight

        if train.target_names[prediction] == test.target_names[target]:
            return correct_weight[index]

    return incorrect_weight


def write_model_to_file(category, target_names, best_min_prob, text_clf):
    with open(
        os.path.join(BASE_PATH, "..", category + "-model-config.json"), "w"
    ) as outfile:
        json.dump(
            {"min_prob": best_min_prob, "target_names": target_names},
            outfile,
            indent=4,
        )
    joblib.dump(text_clf, os.path.join(BASE_PATH, "..", category + "-model.pickle"))


def find_best(
    cutoff_method, scores, score_tuples, test, train, initial_prediction, category,
):
    best_res = None
    best_min_prob = None
    best_prediction = None
    best_cutoff = None
    best_method = None
    best_train = None
    best_test = None
    best_ignore_labels = None
    best_clf = None

    if not FILTER_DATA:
        train = load_train(category)
        text_clf = new_text_clf().fit(train.data, train.target)
        probabilities = text_clf.predict_proba(test.data)

    for cutoff in range(0, 100, CUTOFF_EXPLORATION_RATE):
        cutoff /= 100

        if FILTER_DATA:
            train = load_train(category)
            filter_data(train, scores, cutoff)
            text_clf = new_text_clf().fit(train.data, train.target)
            probabilities = text_clf.predict_proba(test.data)

        ignore_labels = [name for name, f in score_tuples if f < cutoff]

        for min_prob in range(0, 100, PROB_EXPLORATION_RATE):
            min_prob /= 100
            predicted = []

            for prob in probabilities:
                best = sorted(enumerate(prob), key=lambda p: -p[1])
                if best[0][1] >= min_prob:
                    predicted.append(
                        [
                            text_clf.classes_[index]
                            for index, value in best
                            if value > min_prob
                        ]
                    )
                else:
                    predicted.append(None)

            res = np.mean(
                [
                    calc_score(
                        predicted,
                        target,
                        train,
                        test,
                        ignore_labels,
                        SKIP_WEIGHT,
                        CORRECT_WEIGHT,
                        INCORRECT_WEIGHT,
                    )
                    for predicted, target in zip(predicted, test.target)
                ]
            )

            if best_res is None or res > best_res:
                best_ignore_labels = ignore_labels
                best_prediction = predicted
                best_cutoff = cutoff
                best_method = cutoff_method
                best_res = res
                best_train = train
                best_test = test
                best_min_prob = min_prob
                best_clf = text_clf

    return (
        best_res,
        best_min_prob,
        best_prediction,
        best_cutoff,
        best_method,
        best_ignore_labels,
        best_train,
        best_test,
        best_clf,
    )


def run_category(category):
    test = load_test(category)
    train = load_train(category)

    print("train categories", train.target_names)
    print("test categories", test.target_names)

    text_clf = new_text_clf().fit(train.data, train.target)
    initial_prediction = text_clf.predict(test.data)

    score_map = {
        "precision": metrics.precision_score(
            test.target, initial_prediction, average=None, zero_division=0
        ),
        "fbeta0.5": metrics.fbeta_score(
            test.target, initial_prediction, 0.5, average=None, zero_division=0
        ),
        "f1": metrics.f1_score(
            test.target, initial_prediction, average=None, zero_division=0
        ),
        "fbeta2": metrics.fbeta_score(
            test.target, initial_prediction, 2, average=None, zero_division=0
        ),
        "recall": metrics.recall_score(
            test.target, initial_prediction, average=None, zero_division=0
        ),
    }

    best_res = None
    best_min_prob = None
    best_prediction = None
    best_cutoff = None
    best_method = None
    best_ignore_labels = None
    best_train = None
    best_test = None
    best_clf = None

    # cutoffs dont seem to happen in practice, so these values dont really matter.
    methods = [
        # "precision",
        # "fbeta0.5",
        "f1",
        # "fbeta2",
        # "recall",
    ]

    for cutoff_method in methods:

        scores = score_map[cutoff_method]
        score_tuples = [
            (train.target_names[text_clf.classes_[i]], f) for i, f in enumerate(scores)
        ]

        (
            res,
            min_prob,
            prediction,
            cutoff,
            cutoff_method,
            ignore_labels,
            train,
            test,
            clf,
        ) = find_best(
            cutoff_method,
            scores,
            score_tuples,
            test,
            train,
            initial_prediction,
            category,
        )

        if best_res is None or res > best_res:
            best_res = res
            best_min_prob = min_prob
            best_prediction = prediction
            best_cutoff = cutoff
            best_method = cutoff_method
            best_ignore_labels = ignore_labels
            best_train = train
            best_test = test
            best_clf = clf

    print()
    print()
    print("Best " + category + ":")
    print_metrics(
        best_method,
        best_cutoff,
        best_train,
        best_test,
        best_prediction,
        best_ignore_labels,
        best_min_prob,
        best_res,
    )
    write_model_to_file(category, best_train.target_names, best_min_prob, best_clf)


def main():
    categories = [
        "type",
        "area",
        "editor",
        "workbench",
    ]

    try:
        cpus = min(cpu_count(), len(categories))
    except NotImplementedError:
        cpus = 1
    print("running on " + str(cpus) + " cpus")

    pool = Pool()

    pool.map(run_category, categories)


if __name__ == "__main__":
    main()
