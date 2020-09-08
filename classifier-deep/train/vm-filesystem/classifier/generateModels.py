# ---------------------------------------------------------------------------------------------
#  Copyright (c) Microsoft Corporation. All rights reserved.
#  Licensed under the MIT License. See LICENSE in the project root for license information.
# ---------------------------------------------------------------------------------------------

from simpletransformers.classification import ClassificationModel, ClassificationArgs
from sklearn.datasets import load_files
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score, accuracy_score
import pandas as pd
import logging
import json
import os

DATA_DIR = "train_data"


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

    X_train, X_test, y_train, y_test = train_test_split(
        data, target, test_size=0.33, random_state=42
    )

    train_df = pd.DataFrame(zip(X_train, y_train))
    train_df.columns = ["text", "labels"]

    test_df = pd.DataFrame(zip(X_test, y_test))
    test_df.columns = ["text", "labels"]

    return test_df, train_df, files.target_names


logging.basicConfig(level=logging.INFO)
transformers_logger = logging.getLogger("transformers")
transformers_logger.setLevel(logging.WARNING)

categories = ["area", "assignee"]

for category in categories:
    test_df, train_df, target_names = load_dataframes(category)

    model_args = ClassificationArgs(
        output_dir=category + "_model",
        best_model_dir=category + "_model_best",
        overwrite_output_dir=True,
        train_batch_size=16,
        eval_batch_size=32,
        max_seq_length=256,
        num_train_epochs=2,
        save_model_every_epoch=False,
        save_eval_checkpoints=False,
    )

    def f1_multiclass(labels, preds):
        return f1_score(labels, preds, average="micro")

    # Create a ClassificationModel
    model = ClassificationModel(
        "bert", "finetuned", num_labels=len(target_names), args=model_args,
    )

    # Train the model
    model.train_model(
        train_df, eval_df=test_df, output_dir=category + "_model/checkpoints"
    )

    # Evaluate the model
    result, model_outputs, wrong_predictions = model.eval_model(
        test_df,
        output_dir=category + "_model/eval",
        f1=f1_multiclass,
        acc=accuracy_score,
    )

    with open(os.path.join(category + "_model", "target_names.json"), "w") as f:
        json.dump(target_names, f)
