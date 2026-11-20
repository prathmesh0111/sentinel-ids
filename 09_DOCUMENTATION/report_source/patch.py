import io

g = io.open('gen_body.py', encoding='utf-8').read()
g = g.replace(
    "story.append(code('final = max( 0.4 x ruleScore + 0.4 x RF_attackProbability + 0.2 x IF_anomalyScore ,  0.9 x ruleScore )'))",
    "story.append(code('final = max( 0.4 x rule + 0.4 x RF_prob + 0.2 x IF_score ,  0.9 x rule )'))")
g = g.replace(
    'exactly the dimensions along which the simulated-and-real attack traffic differs from genuine browsing.',
    'exactly the dimensions along which attack traffic differs from genuine browsing.')
g = g.replace("'Table 8 - Admin console pages')", "'Table 7 - Admin console pages')")
g = g.replace('Live tuning of every threshold in Table 7 (risk threshold',
              'Live tuning of every threshold in Table 8 (risk threshold')
g = g.replace("'Table 7 - Detection and training settings', mono_cols=(0,))",
              "'Table 8 - Detection and training settings', mono_cols=(0,))")
io.open('gen_body.py', 'w', encoding='utf-8').write(g)

m = io.open('make_cover.py', encoding='utf-8').read()
m = m.replace('FRAUD & IP ANOMALY DETECTION', 'SECURITY')
io.open('make_cover.py', 'w', encoding='utf-8').write(m)

ok1 = '0.4 x rule +' in g and 'ruleScore + 0.4' not in g
ok2 = "TECHNICAL DOCUMENTATION  \u00b7  SECURITY'" in m
print('body patched:', ok1, '| cover patched:', ok2)
