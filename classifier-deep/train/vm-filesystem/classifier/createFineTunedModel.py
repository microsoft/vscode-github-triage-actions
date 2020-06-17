#---------------------------------------------------------------------------------------------
#  Copyright (c) Microsoft Corporation. All rights reserved.
#  Licensed under the MIT License. See LICENSE in the project root for license information.
#---------------------------------------------------------------------------------------------

# Run once (or at least infrequently) to create a version of BERT fine-tuned to what this repo's issues look like.

from simpletransformers.language_modeling import LanguageModelingModel
import logging
import os
import json
import random



logging.basicConfig(level=logging.INFO)
transformers_logger = logging.getLogger("transformers")
transformers_logger.setLevel(logging.WARNING)

train_token_path = 'issues.train.tokens'
test_token_path = 'issues.test.tokens'

if not os.path.exists(train_token_path):
  print("creating token files")
  with open('issues.json') as f:
    issues = [json.loads(line) for line in f.readlines()]
    test = []
    train = []
    for issue in issues:
      body = issue['title'] + ' ' + issue['body'].replace('\n', ' ').replace('\r', ' ')
      if random.random() > 0.8:
        test.append(body)
      else:
        train.append(body)
    with open(train_token_path, 'w') as p:
      p.write('\n'.join(train))
    with open(test_token_path, 'w') as p:
      p.write('\n'.join(test))

print("training model")

train_args = {
    "reprocess_input_data": True,
    "overwrite_output_dir": True,
    "save_steps": 10000
}

model = LanguageModelingModel("bert", "bert-base-uncased", args=train_args)

model.train_model(
    "issues.train.tokens",
    eval_file="issues.test.tokens",
    output_dir="finetuned",
)

model.eval_model("issues.test.tokens", "finetune-eval")