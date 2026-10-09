/**
 * Shared by check_deck.js and make_previews.js: converts a .pptx to PDF with LibreOffice.
 *
 * LibreOffice only finds some fonts on its own. To render with the fonts the deck names
 * (Poppins, Arial, Georgia, ...) this uses a private LibreOffice profile and copies the
 * installed font files into it. Your own LibreOffice settings are not touched.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const FONT_DIRS = [path.join(os.homedir(), "Library", "Fonts"), "/Library/Fonts", "/System/Library/Fonts/Supplemental", "/usr/share/fonts", path.join(os.homedir(), ".fonts"), path.join(os.homedir(), ".local", "share", "fonts")];
const FONT_FILE = /^(Poppins|Arial|Georgia|Cambria|Calibri)[^/]*\.(ttf|otf)$/i;

function findSoffice() {
  return [process.env.SOFFICE, "/Applications/LibreOffice.app/Contents/MacOS/soffice", "/usr/bin/soffice", "/usr/local/bin/soffice", "soffice"]
    .filter(Boolean).find((p) => p === "soffice" || fs.existsSync(p));
}

function profileWithFonts() {
  const profile = path.join(os.tmpdir(), "showship-lo-profile");
  const fonts = path.join(profile, "user", "fonts");
  fs.mkdirSync(fonts, { recursive: true });
  const walk = (dir, depth) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && depth < 3) walk(p, depth + 1);
      else if (FONT_FILE.test(e.name) && !fs.existsSync(path.join(fonts, e.name))) fs.copyFileSync(p, path.join(fonts, e.name));
    }
  };
  FONT_DIRS.forEach((d) => walk(d, 0));
  return profile;
}

/** Returns the path of the PDF written to outDir. Throws if LibreOffice is missing or fails. */
function renderPdf(pptx, outDir) {
  const soffice = findSoffice();
  const profile = profileWithFonts();
  execFileSync(soffice, [`-env:UserInstallation=file://${profile}`, "--headless", "--convert-to", "pdf", "--outdir", outDir, path.resolve(pptx)], { stdio: "ignore" });
  return path.join(outDir, path.basename(pptx).replace(/\.pptx$/i, ".pdf"));
}

module.exports = { renderPdf };
