# 005 Toon shading with inverted-hull ink outlines

- **Context.** The "Moonlit Toybox" style (ART_STYLE.md) needs bold outlines on every object, on low-end laptops.
- **Options.** (a) Inverted-hull outline as a second material slot. (b) A post-process edge pass.
- **Decision.** (a), with outline LOD (outlines dropped far from the camera) and merged static geometry.
- **Consequences.** Consistent look and no extra full-screen pass, but up to 2× draw calls per inked mesh; budget is
  about 300 draw calls in an invasion on low graphics.
