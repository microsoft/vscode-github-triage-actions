from sklearn.feature_extraction.text import CountVectorizer
from nltk.stem import SnowballStemmer

# Keep seprate from service.py because of something to do with pickle?

stemmer = SnowballStemmer("english")


class StemmedCountVectorizer(CountVectorizer):
    def build_tokenizer(self):
        tokenizer = super(StemmedCountVectorizer, self).build_tokenizer()
        return lambda doc: ([stemmer.stem(w) for w in tokenizer(doc)])
