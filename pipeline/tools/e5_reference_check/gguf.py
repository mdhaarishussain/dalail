import json
import math
import sys

from llama_cpp import Llama

s = json.load(open(sys.argv[1]))
llm = Llama(model_path=sys.argv[2], embedding=True, n_ctx=511, verbose=False)
out = []
for t in s:
    v = llm.embed(t)
    n = math.sqrt(sum(x * x for x in v))
    out.append([x / n for x in v])
print(json.dumps(out))
