import json
import sys

from sentence_transformers import SentenceTransformer

s = json.load(open(sys.argv[1]))
m = SentenceTransformer("intfloat/multilingual-e5-small", revision=None)
print(json.dumps(m.encode(s, normalize_embeddings=True).tolist()))
