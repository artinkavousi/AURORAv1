from pathlib import Path
path = Path('router.js')
text = path.read_text()
old = "    if (source.startsWith('macro:')) {\n      const key = source.slice(6);\n      return clamp(features.macroWeights?.[key] ?? (features.macroState === key ? features.macroStrength ?? 0 : 0), 0, 1);\n    }"
if old not in text:
    raise SystemExit('old macro block not found')
new = "    if (source.startsWith('macro:')) {\n      const key = source.slice(6);\n      const base = features.macroWeights?.[key] ?? (features.macroState === key ? features.macroStrength ?? 0 : 0);\n      const gainKey = 'audioMacro' + key[0].upper() + key[1:] + 'Gain';\n      const gain = conf and isinstance(conf, dict) and isinstance(conf.get(gainKey), (int, float)) and conf.get(gainKey) or 1.0\n      return clamp(base * gain, 0, 2);\n    }"
