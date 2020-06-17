#---------------------------------------------------------------------------------------------
#  Copyright (c) Microsoft Corporation. All rights reserved.
#  Licensed under the MIT License. See LICENSE in the project root for license information.
#---------------------------------------------------------------------------------------------

from simpletransformers.classification import ClassificationModel
from sklearn.datasets import load_files
from sklearn.model_selection import train_test_split
import json
import pandas as pd
import logging
import os

DATA_DIR = 'train_data'

def load_dataframes(category):
    files = load_files(
        os.path.join(DATA_DIR, category),
        encoding="utf-8",
        decode_error="replace",
        shuffle=True,
        random_state=42,
    )

    data = files.data
    target = files.target

    X_train, X_test, y_train, y_test = train_test_split(data, target, test_size=0.33, random_state=42)

    train_df = pd.DataFrame(zip(X_train, y_train))
    train_df.columns = ["text", "labels"]

    test_df = pd.DataFrame(zip(X_test, y_test))
    test_df.columns = ["text", "labels"]

    return test_df, train_df, files.target_names


logging.basicConfig(level=logging.INFO)
transformers_logger = logging.getLogger("transformers")
transformers_logger.setLevel(logging.WARNING)

categories = ['area', 'assignee']

def getThresholds(label, predictions, raw_outputs, real_labels, data_target_names, model_target_names):
    cutoffs = {}

    guesses = []
    for prediction, raw_output, real_label in zip(predictions, raw_outputs, real_labels):
        if model_target_names[prediction] == label:
            guesses.append(
                (raw_output[prediction],
                prediction == real_label,)
            )
    guesses.sort(reverse=True)

    print("Computing thresholds for label", label)
    num_total = int(len([real_label for real_label in real_labels if data_target_names[real_label] == label]))

    for target_precision in range(0,101,5):
        target_precision /= 100

        num_guessed = 0
        num_correct = 0

        for score, correct in guesses:
            if correct:
                num_correct += 1
            num_guessed += 1

            if num_correct/num_guessed >= target_precision:
                cutoffs[target_precision] = {
                    'cutoff': float(score),
                    'num_correct':num_correct,
                    'num_guessed':num_guessed,
                    'num_total': num_total,
                    'precision': num_correct/num_guessed if num_guessed != 0 else 'NaN',
                    'recall': num_correct/num_total if num_total != 0 else 'NaN'
                }


    return cutoffs


for category in categories:
    test_df, train_df, data_target_names = load_dataframes(category)
    thresholds = {}

    with open(os.path.join( category+'_model','target_names.json')) as fp:
        model_target_names = json.load(fp)


    # Create a ClassificationModel
    model = ClassificationModel(
        'bert',
        category+'_model',
        num_labels=len(model_target_names)
    )

    # Make predictions with the model
    predictions, raw_outputs = model.predict(test_df['text'])

    for data_target_name in data_target_names:
        thresholds[data_target_name] = getThresholds(data_target_name, predictions, raw_outputs, test_df['labels'], data_target_names, model_target_names)

    for target_precision in range(0,101,5):
        target_precision /= 100

        total_items = 0
        total_correct = 0

        for data_target_name in data_target_names:
            if target_precision in thresholds[data_target_name]:
                total_items += thresholds[data_target_name][target_precision]['num_total']
                total_correct += thresholds[data_target_name][target_precision]['num_correct']

        print(
            'Category ', category, 'target: ' ,target_precision,
            'results:',
            total_correct, '/', total_items,' (', total_correct/total_items, ')'
        )

    with open(os.path.join(category+'_model', 'thresholds.json'), 'w') as fp:
        json.dump(thresholds, fp)