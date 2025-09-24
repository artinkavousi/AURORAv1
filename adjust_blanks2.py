from pathlib import Path
path = Path('flow - Copy/src/app.js')
text = path.read_text()
text = text.replace("        }\r\n\r\n    async update", "        }\r\n    async update")
path.write_text(text)
