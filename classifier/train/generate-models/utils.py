# ---------------------------------------------------------------------------------------------
#  Copyright (c) Microsoft Corporation. All rights reserved.
#  Licensed under the MIT License. See LICENSE in the project root for license information.
# --------------------------------------------------------------------------------------------*/

from sklearn.feature_extraction.text import CountVectorizer
from nltk.stem import SnowballStemmer

# Keep seprate from generate.py because of something to do with pickle?

stemmer = SnowballStemmer("english")


class StemmedCountVectorizer(CountVectorizer):
    def build_tokenizer(self):
        tokenizer = super(StemmedCountVectorizer, self).build_tokenizer()
        return lambda doc: ([stemmer.stem(w) for w in tokenizer(doc)])
