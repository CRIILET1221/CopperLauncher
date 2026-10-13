# Third-party materials in Copper Launcher

Copper's launcher, installer and uninstaller are licensed GPL-3.0-only. Original Millida attribution is preserved in NOTICE, and its separate brand/service terms remain in TRADEMARK.md.

## License notices

[THIRD-PARTY-LICENSES.txt](THIRD-PARTY-LICENSES.txt) collects the copyright and license texts found in the installed JavaScript packages and Windows Cargo dependencies, plus upstream notices for packages that omit a standalone license file from their registry archive. Build-time dependencies are included too. The collection does not change those licenses or certify every compatibility question.

Rust dependencies are pinned in src-tauri/Cargo.lock. JavaScript dependencies are pinned in bun.lock. Rust source archives are identified by package/version in the collected notices. The generator is scripts/collect-license-notices.mjs; run it after updating dependencies using fresh cargo metadata. Supplemental notices, with provenance where available, live in license-notices/.

## Fonts

The bundled fonts retain SIL Open Font License 1.1. Their copyright notices and full license text are in public/fonts/OFL.txt. The custom installer and uninstaller embed Geist, include OFL.txt, and display the notice through their font-license panel. Installation also places OFL.txt beside the application.

## Graphics

- The original Millida background images/videos and its 54 block PNGs have been removed.
- Other legacy promotional/game/version imagery and the copied instance-icon image pack have been removed from this distribution.
- New public/bg/*.svg and public/block-icons/*.svg are original geometric Copper artwork under GPL-3.0-only. The editable generator is scripts/generate-copper-art.mjs. No original Minecraft textures were used to generate these vectors.
- The user-supplied Copper cube and the new vector C monogram app icon are kept as separate project artwork. This statement does not grant rights to any third-party work they might reproduce; Minecraft brand/asset rules still apply where relevant.
- Bundled category/loader image files now use original Copper glyphs. Provider and loader names remain descriptive text; their respective owners retain rights to their names and marks. References do not indicate endorsement.

## Minecraft and downloaded content

Minecraft is owned by Mojang/Microsoft. Game use requires the applicable license. An offline profile does not grant permission to use an unpurchased game. Copper's distribution contains its own programs, not a bundled Minecraft client. Game and mod downloads remain subject to their respective licenses and service terms.

**NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.**
